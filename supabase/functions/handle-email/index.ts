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
// @ts-ignore - Supabase client for Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// Process incoming email
async function processIncomingEmail(emailData: EmailData) {
  try {
    // Extract the username from the 'to' address (format: username@newsletterhub.com)
    const [username] = emailData.to.split('@');
    
    // Look up the user by their email alias
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email_alias')
      .eq('email_alias', username)
      .single();

    if (userError || !userData) {
      console.error('User not found for alias:', username);
      return { error: 'User not found' };
    }

    // Store the newsletter in the database
    const { data, error } = await supabase
      .from('newsletters')
      .insert([
        {
          user_id: userData.id,
          from_email: emailData.from,
          subject: emailData.subject,
          content: emailData.html || emailData.text,
          received_at: new Date().toISOString(),
          is_read: false,
        },
      ])
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
