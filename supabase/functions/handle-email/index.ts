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
  from: string;
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
      let formData: FormData | null = null;

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
        const signature = formData.get('signature') as string;
        const token = formData.get('token') as string;
        const timestamp = formData.get('timestamp') as string;
        
        if (!signature || !token || !timestamp) {
          console.error('Missing Mailgun signature parameters in form data');
          return new Response('Missing Mailgun signature parameters', { status: 400 });
        }
        
        const isValid = await verifyMailgunWebhook(token, timestamp, signature);
        if (!isValid) {
          console.error('Invalid Mailgun signature');
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
      return new Response(JSON.stringify({ error: 'Error processing request' }), { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  }

  // Handle other HTTP methods
  return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
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
): Promise<{ source: Source; created: boolean; isArchived: boolean }> {
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

  // If source exists, check if it's archived
  if (existingSource) {
    if (existingSource.is_archived) {
      // Return the source with isArchived: true - we don't unarchive it anymore
      return { source: existingSource, created: false, isArchived: true };
    }
    return { source: existingSource, created: false, isArchived: false };
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

  return { source: newSource, created: true, isArchived: false };
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

    // Find or create the source
    const { source, isArchived } = await findOrCreateSource(fromEmail, fromName, supabaseWithAuth);
    
    // If source is archived, skip processing
    if (isArchived) {
      console.log(`Skipping processing for archived source: ${fromEmail}`);
      return {
        success: true,
        data: { skipped: true, reason: 'Source is archived' }
      };
    }

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
 * Verifies the signature of a Mailgun webhook request using POST body parameters
 */
async function verifyMailgunWebhook(
  token: string,
  timestamp: string,
  signature: string
): Promise<boolean> {
  try {
    // Get the Mailgun API key from environment variables
    const mailgunApiKey = Deno.env.get('MAILGUN_API_KEY');
    if (!mailgunApiKey) {
      console.error('MAILGUN_API_KEY is not set');
      return false;
    }

    // Convert the API key to a Uint8Array for use with WebCrypto
    const encoder = new TextEncoder();
    const keyData = encoder.encode(mailgunApiKey);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Create the signature string to verify
    const signatureData = `${timestamp}${token}`;
    const signatureBytes = encoder.encode(signatureData);
    
    // Convert the hex signature to bytes
    const signatureHex = atob(signature.replace(/-/g, '+').replace(/_/g, '/'));
    const signatureBuffer = new Uint8Array(signatureHex.length);
    for (let i = 0; i < signatureHex.length; i++) {
      signatureBuffer[i] = signatureHex.charCodeAt(i);
    }

    // Verify the signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      signatureBytes
    );

    return isValid;
  } catch (error) {
    console.error('Error verifying Mailgun webhook signature:', error);
    return false;
  }
}

// Helper function to parse message headers string into an object
function parseMessageHeaders(headersString: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headersString) return headers;
  
  const lines = headersString.split('\n');
  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex > 0) {
      const key = line.substring(0, separatorIndex).trim().toLowerCase();
      const value = line.substring(separatorIndex + 1).trim();
      headers[key] = value;
    }
  }
  return headers;
}

// For local development
// @ts-ignore
if (typeof Deno !== 'undefined' && Deno.env.get('SUPABASE_ENVIRONMENT') !== 'production') {
  // @ts-ignore
  Deno.serve(handler);
}