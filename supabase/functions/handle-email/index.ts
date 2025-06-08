// This function handles incoming emails for the newsletter hub
// It's designed to work with Mailgun's inbound email webhooks

// Environment variables for Mailgun webhook verification
// @ts-ignore - Deno.env is available in the Deno runtime
const MAILGUN_API_KEY = Deno.env.get('MAILGUN_API_KEY') || '';
// @ts-ignore - Deno.env is available in the Deno runtime
const MAILGUN_WEBHOOK_SIGNING_KEY = Deno.env.get('MAILGUN_WEBHOOK_SIGNING_KEY') || '';

// This URL will be used to forward the email data to our frontend
// @ts-ignore - Deno.env is available in the Deno runtime
const FRONTEND_WEBHOOK_URL = Deno.env.get('FRONTEND_WEBHOOK_URL') || '';

// Import the crypto module for signature verification
// @ts-ignore - crypto is available in the Deno runtime
const { createHmac } = crypto;

// Create a Supabase client
// @ts-import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parse } from 'https://esm.sh/node-html-parser@6.1.10';

// Initialize Supabase client with service role key
// @ts-ignore - Deno.env is available in the Deno runtime
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
// @ts-ignore - Deno.env is available in the Deno runtime
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Interface for the email data
interface EmailData {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  'message-headers': string;
  'recipient'?: string;
  'sender'?: string;
}

// Configuration
const WORDS_PER_MINUTE = 200;

// Function to calculate word count from HTML
function getWordCount(html: string): number {
  try {
    // Parse HTML and get text content
    const root = parse(html);
    const text = root.textContent || '';
    
    // Count words (split by whitespace and filter out empty strings)
    return text.trim().split(/\s+/).filter(Boolean).length;
  } catch (error) {
    console.error('Error calculating word count:', error);
    return 0;
  }
}

// Function to calculate read time in minutes
function calculateReadTime(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_MINUTE) || 1; // At least 1 minute
}

// Verify Mailgun webhook signature
function verifyMailgunWebhook(
  token: string,
  timestamp: string,
  signature: string
): boolean {
  const encodedToken = createHmac('sha256', MAILGUN_WEBHOOK_SIGNING_KEY)
    .update(timestamp + token)
    .digest('hex');
  return encodedToken === signature;
}

// Process incoming email and insert into newsletters table with updated schema
async function processIncomingEmail(emailData: EmailData) {
  try {
    // Look up the user by their full email alias (the full 'to' field)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email_alias')
      .eq('email_alias', emailData.to)
      .single();

    if (userError || !userData) {
      console.error('User not found for alias:', emailData.to);
      return { error: 'User not found' };
    }

    // Extract domain from the 'from' email address
    const fromDomain = (emailData.from.split('@')[1] || '').toLowerCase();

    // Look up the newsletter source for this user and domain
    let newsletterSourceId: string | null = null;
    if (fromDomain) {
      const { data: sourceData, error: sourceError } = await supabase
        .from('newsletter_sources')
        .select('id')
        .eq('user_id', userData.id)
        .eq('domain', fromDomain)
        .single();
      if (!sourceError && sourceData?.id) {
        newsletterSourceId = sourceData.id;
      }
    }

    // Get the content (prefer HTML but fall back to plain text)
    const content = emailData.html || emailData.text || '';
    
    // Calculate word count and read time
    const wordCount = getWordCount(content);
    const readTimeMinutes = calculateReadTime(wordCount);

    // Prepare newsletter fields based on the current schema
    const newsletterInsert = {
      user_id: userData.id,
      from_email: emailData.from,
      subject: emailData.subject || '',
      content: content,
      received_at: new Date().toISOString(),
      is_read: false,
      is_liked: false,
      is_archived: false,
      title: emailData.subject || null,
      summary: null,
      image_url: null,
      newsletter_source_id: newsletterSourceId,
      word_count: wordCount,
      estimated_read_time: readTimeMinutes,
    };

    const { data, error } = await supabase
      .from('newsletters')
      .insert([newsletterInsert])
      .select();

    if (error) {
      console.error('Error saving newsletter:', error);
      return { error: 'Failed to save newsletter' };
    }

    return { data };
  } catch (error) {
    console.error('Error processing email:', error);
    return { error: 'Internal server error' };
  }
}


// This is the main function that will be called by Supabase Edge Functions
export default async function handler(req: Request) {
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle POST requests
  if (req.method === 'POST') {
    try {
      // This captures the form data from Mailgun's webhook
      const formData = await req.formData();
      
      // Verify the request is from Mailgun (in production)
      if (Deno.env.get('SUPABASE_ENVIRONMENT') === 'production') {
        const signature = req.headers.get('x-mailgun-signature');
        const token = req.headers.get('x-mailgun-token');
        const timestamp = req.headers.get('x-mailgun-timestamp');
        
        if (!signature || !token || !timestamp) {
          return new Response('Missing Mailgun signature headers', { status: 400 });
        }
        
        if (!verifyMailgunWebhook(token, timestamp, signature)) {
          return new Response('Invalid signature', { status: 403 });
        }
      }
      
      // Process the email
      const emailData: EmailData = {
        to: formData.get('recipient') as string,
        from: formData.get('from') as string,
        subject: formData.get('subject') as string,
        text: formData.get('body-plain') as string,
        html: formData.get('body-html') as string,
        'message-headers': formData.get('message-headers') as string,
      };

      const result = await processIncomingEmail(emailData);
      
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response(JSON.stringify({ success: true, data: result.data }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response('Error processing request', { status: 500 });
    }
  }

  // Handle other HTTP methods
  return new Response('Method not allowed', { 
    status: 405,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// For local development
// @ts-ignore
if (import.meta.env.MODE === 'development') {
  // @ts-ignore
  Deno.serve(handler);
}
