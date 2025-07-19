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
  skipped?: boolean;
  skipReason?: string;
  skipDetails?: any;
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function findOrCreateSource(
  email: string,
  name: string,
  supabase: any,
  userId?: string | null
): Promise<{ source: Source; created: boolean; isArchived: boolean }> {
  // Match on both 'from' (email) and 'name' (title)
  const { data: sources, error: findError } = await supabase
    .from('newsletter_sources')
    .select('*')
    .ilike('from', email)
    .ilike('name', name);

  if (findError) {
    console.error('Error finding source:', findError);
    throw new Error(`Failed to find source: ${findError.message}`);
  }

  if (sources && sources.length > 1) {
    // Multiple sources found for the same 'from' email and name
    const ids = sources.map(s => s.id).join(', ');
    console.warn(`Multiple sources found for email ${email} and name ${name}. Using the first one. IDs: ${ids}`);
    return {
      source: sources[0],
      created: false,
      isArchived: sources[0].is_archived || false
    };
  } else if (sources && sources.length === 1) {
    // Exactly one source found
    return {
      source: sources[0],
      created: false,
      isArchived: sources[0].is_archived || false
    };
  }

  // Only check can_add_source if we have a user ID (not for system operations)
  if (userId) {
    const { data: canAddSource, error: sourceLimitError } = await supabase
      .rpc('can_add_source', { user_id_param: userId });

    if (sourceLimitError) {
      console.error('Error checking source limit:', sourceLimitError);
      throw new Error(`Failed to check source limit: ${sourceLimitError.message}`);
    }

    if (canAddSource === false) {
      console.log(`User ${userId} cannot add more sources due to plan limits`);
      throw new Error('Source limit reached for your subscription plan');
    }
  }

  // If source doesn't exist and user can add it (or no user context), create a new one
  const { data: newSource, error: createError } = await supabase
    .from('newsletter_sources')
    .insert([
      {
        from: email,
        name: name || email.split('@')[0], // Use the part before @ as name if not provided
        user_id: userId || null,
      },
    ])
    .select()
    .single();

  if (createError) {
    console.error('Error creating source:', createError);
    throw new Error(`Failed to create source: ${createError.message}`);
  }

  // After successfully creating a new source, increment the source count
  if (userId) {
    const { error: incrementError } = await supabase
      .rpc('increment_source_count', { user_id_param: userId });

    if (incrementError) {
      console.error('Error incrementing source count:', incrementError);
      // Don't fail the entire operation if incrementing fails, just log it
    }
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

  let userId: string | null = null; // Ensure userId is always defined
  let fromEmail: string = '';
  let fromName: string = '';

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
    fromEmail = fromMatch ? fromMatch[1] : emailData.from;
    fromName = emailData.from.replace(/<[^>]+>/g, '').trim();

    // Find or create the source
    const { source, isArchived } = await findOrCreateSource(fromEmail, fromName, supabaseWithAuth, userId);

    // If source is archived, skip processing
    if (isArchived) {
      console.log(`Skipping processing for archived source: ${fromEmail}`);
      return {
        success: true,
        skipped: true,
        skipReason: 'source_archived',
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

    // Check if user can receive this newsletter
    console.log('Checking if user can receive newsletter for:', userId);
    const { data: canReceiveData, error: limitError } = await supabaseWithAuth.rpc(
      'can_receive_newsletter',
      {
        user_id_param: userId,
        title: emailData.subject,
        content: emailData['body-plain']
      }
    );

    if (limitError) {
      console.error('Error checking subscription limits:', limitError);
      // Continue processing but log the error
      console.log('Proceeding with newsletter storage despite limit check error');
    } else if (canReceiveData) {
      // Parse the JSONB response
      const canReceive = typeof canReceiveData === 'string'
        ? JSON.parse(canReceiveData)
        : canReceiveData;

      console.log('Can receive newsletter check result:', JSON.stringify(canReceive, null, 2));

      if (!canReceive.can_receive) {
        // User cannot receive this newsletter due to limits
        const skipReason = canReceive.reason || 'limit_reached';
        console.log(`Skipping newsletter for user ${userId}: ${skipReason}`, canReceive);

        // Store in skipped_newsletters with reason
        const { error: skipError } = await supabaseWithAuth
          .from('skipped_newsletters')
          .insert({
            user_id: userId,
            title: emailData.subject,
            content: emailData['body-html'] || emailData['body-plain'],
            received_at: new Date().toISOString(),
            newsletter_source_id: source?.id,
            skip_reason: skipReason,
            skip_details: {
              limit_details: canReceive,
              from_email: fromEmail,
              received_at: new Date().toISOString()
            }
          });

        if (skipError) {
          console.error('Error saving skipped newsletter:', skipError);
        } else {
          console.log(`Successfully saved skipped newsletter for user ${userId} with reason: ${skipReason}`);
        }

        // Return early without calling handle_incoming_email_transaction
        return {
          success: true,
          skipped: true,
          skipReason,
          skipDetails: canReceive,
          userId,
          data: {
            skipped: true,
            reason: skipReason,
            details: canReceive
          }
        };
      } else {
        console.log('User can receive newsletter, proceeding with processing');
      }
    } else {
      console.log('No canReceiveData received, proceeding with processing');
    }

    console.log('Processing email with handle_incoming_email_transaction for user:', userId);
    // Only process the email if we didn't hit any limits
    const { data, error } = await supabaseWithAuth.rpc(
      'handle_incoming_email_transaction',
      {
        p_user_id: userId,
        p_from_email: fromEmail,
        p_from_name: fromName,
        p_subject: emailData.subject,
        p_content: emailData['body-html'] || emailData['body-plain'],
        p_excerpt: emailData['body-plain']?.substring(0, 200) || '',
        p_raw_headers: JSON.stringify(emailData['message-headers'] || [])
      }
    );

    if (error) {
      console.error('Transaction error:', error);

      // If the error is due to duplicate detection in the transaction, log it as skipped
      if (error.message.includes('duplicate') || error.message.includes('already exists')) {
        // Store in skipped_newsletters with duplicate reason
        await supabaseWithAuth
          .from('skipped_newsletters')
          .insert({
            user_id: userId,
            title: emailData.subject,
            content: emailData['body-html'] || emailData['body-plain'],
            received_at: new Date().toISOString(),
            newsletter_source_id: source.id,
            skip_reason: 'duplicate',
            skip_details: {
              error: error.message,
              from_email: fromEmail,
              received_at: new Date().toISOString()
            }
          });

        return {
          success: true,
          skipped: true,
          skipReason: 'duplicate',
          userId,
          data: { skipped: true, reason: 'duplicate' }
        };
      }

      throw new Error(`Transaction failed: ${error.message}`);
    }

    return {
      success: true,
      userId,
      data
    };
  } catch (error) {
    console.error('Error processing email:', error);

    // Log the error to skipped_newsletters if we have a userId
    if (typeof userId === 'undefined') userId = null;
    if (userId) {
      try {
        await supabaseWithAuth
          .from('skipped_newsletters')
          .insert({
            user_id: userId,
            title: emailData.subject,
            content: emailData['body-html'] || emailData['body-plain'],
            received_at: new Date().toISOString(),
            skip_reason: 'processing_error',
            skip_details: {
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
              from_email: fromEmail,
              received_at: new Date().toISOString()
            }
          });
      } catch (logError) {
        console.error('Error logging skipped newsletter:', logError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      userId: userId || undefined
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