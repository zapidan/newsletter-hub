import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

interface EmailData {
  to: string;
  from: string;
  subject: string;
  'body-plain': string;
  'body-html': string;
  'message-headers': string;
  recipient?: string; // For backward compatibility with 'recipient' field
}

interface Source {
  id: string;
  user_id: string;
  name: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

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
      let emailData: EmailData;
      const contentType = req.headers.get('content-type') || '';

      // Clone the request for potential multiple reads
      const reqClone = req.clone();
      let jsonData: any;

      // Check if the request is JSON
      if (contentType.includes('application/json')) {
        try {
          jsonData = await req.json();
          emailData = {
            to: jsonData.recipient || jsonData.to,
            from: jsonData.from,
            subject: jsonData.subject,
            'body-html': jsonData['body-html'] || jsonData.html || '',
            'body-plain': jsonData['body-plain'] || jsonData.text || '',
            'message-headers': jsonData['message-headers'] || `From: ${jsonData.from}\nTo: ${jsonData.recipient || jsonData.to}\nSubject: ${jsonData.subject}`
          };
        } catch (e) {
          console.error('Error parsing JSON:', e);
          return new Response('Invalid JSON', { status: 400 });
        }
      } 
      // Otherwise try to parse as form data
      else {
        try {
          const formData = await reqClone.formData();
          emailData = {
            to: formData.get('recipient') as string || formData.get('to') as string || '',
            from: formData.get('from') as string || '',
            subject: formData.get('subject') as string || '',
            'body-plain': formData.get('body-plain') as string || formData.get('text') as string || '',
            'body-html': formData.get('body-html') as string || formData.get('html') as string || '',
            'message-headers': formData.get('message-headers') as string || `From: ${formData.get('from')}\nTo: ${formData.get('recipient')}\nSubject: ${formData.get('subject')}`
          };
        } catch (e) {
          console.error('Error parsing form data:', e);
          return new Response('Invalid form data', { status: 400 });
        }
      }

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

interface ProcessEmailResult {
  success: boolean;
  data?: any;
  error?: string;
  userId?: string | null;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findOrCreateSource(
  email: string, 
  name: string,
  supabase: any
): Promise<{ source: Source; created: boolean }> {
  // First, try to find an existing source by 'from' field (case-insensitive)
  const { data: existingSource, error: findError } = await supabase
    .from('newsletter_sources')
    .select('*')
    .ilike('from', email)
    .maybeSingle();

  if (findError) {
    console.error('Error finding source:', findError);
    throw new Error(`Failed to find source: ${findError.message}`);
  }

  // If source exists, update if archived
  if (existingSource) {
    if (existingSource.is_archived) {
      const { data: updatedSource, error: updateError } = await supabase
        .from('newsletter_sources')
        .update({ is_archived: false })
        .eq('id', existingSource.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error unarchiving source:', updateError);
        throw new Error(`Failed to unarchive source: ${updateError.message}`);
      }
      return { source: updatedSource, created: false };
    }
    return { source: existingSource, created: false };
  }

  // If source doesn't exist, create a new one
  const { data: newSource, error: createError } = await supabase
    .from('newsletter_sources')
    .insert([
      {
        from: email,
        name: name || email.split('@')[0], // Use the part before @ as name if not provided
        user_id: null, // Will be set by RLS or trigger
      },
    ])
    .select()
    .single();

  if (createError) {
    console.error('Error creating source:', createError);
    throw new Error(`Failed to create source: ${createError.message}`);
  }

  return { source: newSource, created: true };
}

async function processIncomingEmail(emailData: EmailData): Promise<ProcessEmailResult> {
  // Create a new Supabase client with service role key
  const supabaseWithAuth = createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  try {
    // Validate required fields before starting transaction
    if (!emailData.from || !emailData.to || !emailData.subject) {
      return { 
        success: false, 
        error: 'Missing required email fields (from, to, or subject)' 
      };
    }

    // Extract sender information
    const fromMatch = emailData.from.match(/<?([^<>]+@[^>\s]+)>?/);
    const fromEmail = fromMatch ? fromMatch[1] : emailData.from;
    const fromName = emailData.from.replace(/<[^>]+>/g, '').trim();

    // Check if 'to' is a full email or just an alias
    let userEmail: string;
    if (emailData.to.includes('@')) {
      // It's a full email, use it directly
      userEmail = emailData.to;
    } else {
      // It's just an alias, append the domain
      userEmail = `${emailData.to}@dzapatariesco.dev`;
    }
    
    // Extract the local part for UUID check
    const emailMatch = userEmail.match(/^([^@]+)@/);
    if (!emailMatch) {
      return {
        success: false,
        error: 'Invalid recipient email format'
      };
    }
    
    const localPart = emailMatch[1];
    let userId: string | null = null;
    
    // Check if the local part is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(localPart)) {
      userId = localPart;
    } else {
      // If not a UUID, look up user by email alias
      const { data: userData, error: userError } = await supabaseWithAuth
        .from('users')
        .select('id')
        .eq('email_alias', userEmail)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          error: `User not found for email alias: ${userEmail}`,
          userId: null
        };
      }
      userId = userData.id;
    }

    // Process the email in a transaction
    const { data, error } = await supabaseWithAuth.rpc(
      'handle_incoming_email_transaction',
      {
        p_user_id: userId, // Pass the resolved user ID
        p_from_email: fromEmail,
        p_from_name: fromName,
        p_subject: emailData.subject,
        p_content: emailData['body-html'] || emailData['body-plain'],
        p_excerpt: emailData['body-plain']?.substring(0, 200) || '', // First 200 chars as excerpt
        p_raw_headers: JSON.stringify(emailData['message-headers'] || [])
      }
    );

    if (error) {
      console.error('Transaction error:', error);
      throw new Error(`Transaction failed: ${error.message}`);
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('Error processing email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

/**
 * Verifies the signature of a Mailgun webhook request
 */
async function verifyMailgunWebhook(token: string, timestamp: string, signature: string): Promise<boolean> {
  try {
    const apiKey = Deno.env.get('MAILGUN_WEBHOOK_SIGNING_KEY');
    if (!apiKey) {
      console.error('MAILGUN_WEBHOOK_SIGNING_KEY is not set');
      return false;
    }

    // The signature is a HMAC-SHA256 hash of timestamp + token
    const encoder = new TextEncoder();
    const data = `${timestamp}${token}`;
    const key = encoder.encode(apiKey);
    const msg = encoder.encode(data);

    // Import crypto.subtle for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Convert the signature from hex to ArrayBuffer
    const signatureBytes = new Uint8Array(
      signature.match(/[\da-f]{2}/gi)!.map(h => parseInt(h, 16))
    ).buffer;

    // Verify the signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      cryptoKey,
      signatureBytes,
      msg
    );

    return isValid;
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

// For local development
// @ts-ignore
if (typeof Deno !== 'undefined' && Deno.env.get('SUPABASE_ENVIRONMENT') !== 'production') {
  // @ts-ignore
  Deno.serve(handler);
}