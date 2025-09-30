import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
// Inlined processing logic from processIncomingEmail.ts to remove cross-file dependency

interface EmailData {
  to: string;
  from: string;
  subject: string;
  'body-plain': string;
  'body-html': string;
  'message-headers': string;
}

interface Source {
  id: string;
  user_id: string;
  name: string;
  from: string;
  created_at: string;
  updated_at: string;
}

/**
 * Escape basic HTML entities (&, <, >, ", ')
 * Prevents HTML/JS injection when rendering fromName
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: Request, supabaseClient?: any) {
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
      let emailData: EmailData | null = null;
      const contentType = req.headers.get('content-type') || '';

      // We will try multiple parsing strategies to be robust against missing/incorrect content-type
      // 1) JSON when content-type indicates JSON
      if (!emailData && contentType.includes('application/json')) {
        try {
          const jsonData: any = await req.clone().json();
          emailData = {
            to: jsonData.recipient || jsonData.to,
            from: jsonData.from,
            subject: jsonData.subject,
            'body-html': jsonData['body-html'] || jsonData.html || '',
            'body-plain': jsonData['body-plain'] || jsonData.text || '',
            'message-headers': jsonData['message-headers'] || `From: ${jsonData.from}\nTo: ${jsonData.recipient || jsonData.to}\nSubject: ${jsonData.subject}`
          } as EmailData;
        } catch (e) {
          // fallthrough
        }
      }

      // 2) FormData (works for multipart/form-data and x-www-form-urlencoded)
      if (!emailData) {
        try {
          const fd = await req.clone().formData();
          emailData = {
            to: (fd.get('recipient') as string) || (fd.get('to') as string) || '',
            from: (fd.get('from') as string) || '',
            subject: (fd.get('subject') as string) || '',
            'body-plain': (fd.get('body-plain') as string) || (fd.get('text') as string) || '',
            'body-html': (fd.get('body-html') as string) || (fd.get('html') as string) || '',
            'message-headers': (fd.get('message-headers') as string) || `From: ${fd.get('from')}\nTo: ${fd.get('recipient')}\nSubject: ${fd.get('subject')}`
          } as EmailData;
        } catch (_e) {
          // fallthrough
        }
      }

      // 3) URL-encoded fallback when content-type is missing/wrong
      if (!emailData) {
        try {
          const raw = await req.clone().text();
          // Heuristic: treat body as URL-encoded if it contains '=' or '&'
          if (raw && (raw.includes('=') || raw.includes('&'))) {
            const params = new URLSearchParams(raw);
            const get = (k: string) => params.get(k) || '';
            emailData = {
              to: get('recipient') || get('to'),
              from: get('from'),
              subject: get('subject'),
              'body-plain': get('body-plain') || get('text'),
              'body-html': get('body-html') || get('html'),
              'message-headers': get('message-headers') || `From: ${get('from')}\nTo: ${get('recipient')}\nSubject: ${get('subject')}`
            } as EmailData;
          }
        } catch (_e) {
          // fallthrough
        }
      }

      if (!emailData) {
        return new Response('Invalid request body', { status: 400, headers: { ...corsHeaders } });
      }

      // Verify the request is from Mailgun (in production) for form-encoded payloads only
      if (Deno.env.get('SUPABASE_ENVIRONMENT') === 'production') {
        // Attempt to extract signature fields from formData first, then URL-encoded fallback
        let signature = '';
        let token = '';
        let timestamp = '';
        let gotAny = false;

        try {
          const fd = await req.clone().formData();
          signature = (fd.get('signature') as string) || '';
          token = (fd.get('token') as string) || '';
          timestamp = (fd.get('timestamp') as string) || '';
          gotAny = !!(signature || token || timestamp);
        } catch (_e) {
          // ignore
        }
        if (!gotAny) {
          try {
            const raw = await req.clone().text();
            const params = new URLSearchParams(raw || '');
            signature = params.get('signature') || '';
            token = params.get('token') || '';
            timestamp = params.get('timestamp') || '';
            gotAny = !!(signature || token || timestamp);
          } catch (_e) {
            // ignore
          }
        }

        if (gotAny) {
          if (!signature || !token || !timestamp) {
            console.error('[handle-email] Missing Mailgun signature parameters');
            return new Response('Missing Mailgun signature parameters', { status: 400, headers: { ...corsHeaders } });
          }
          const isValid = await verifyMailgunWebhook(token, timestamp, signature);
          if (!isValid) {
            console.error('[handle-email] Invalid Mailgun signature');
            return new Response('Invalid signature', { status: 403, headers: { ...corsHeaders } });
          }
        }
      }

      const supabase = supabaseClient || getSupabaseClient();

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('processIncomingEmail timeout after 25s')), 25000)
      );

      const result = await Promise.race([
        processIncomingEmail(emailData, supabase),
        timeoutPromise
      ]) as any;

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

export async function processIncomingEmail(emailData: EmailData, supabase: any): Promise<ProcessEmailResult> {
  let userId: string | null = null;
  let fromEmail: string = '';
  let fromName: string = '';

  try {
    // Choose client: use injected if it looks valid, otherwise create a fresh one
    const client = (supabase && typeof (supabase as any).from === 'function') ? supabase : getSupabaseClient();
    if (!emailData.from || !emailData.to || !emailData.subject) {
      return {
        success: false,
        error: 'Missing required email fields (from, to, or subject)'
      };
    }

    const fromMatch = emailData.from.match(/<?([^<>]+@[^>\s]+)>?/);
    fromEmail = fromMatch ? fromMatch[1] : emailData.from;
    fromName = escapeHtml(emailData.from.replace(/<[^>]+>/g, '').trim());

    // Assume only one recipient and resolve user strictly from DB using email_alias
    const userEmail = emailData.to.trim();

    // Basic recipient email format validation
    const simpleEmailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!simpleEmailRegex.test(userEmail)) {
      return {
        success: false,
        error: 'Invalid recipient email format'
      };
    }

    // Resolve userId via DB (no regex/local-part UUID inference)
    const { data: userData, error: userError } = await client
      .from('users')
      .select('id')
      .eq('email_alias', userEmail)
      .single();

    if (userError || !userData) {
      const fallbackUserId = Deno.env.get('DEFAULT_RECIPIENT_USER_ID') || '';
      if (fallbackUserId) {
        userId = fallbackUserId;
      } else {
        return {
          success: true,
          skipped: true,
          skipReason: 'unknown_recipient',
          skipDetails: { userEmail },
          userId: null,
          data: { skipped: true, reason: 'unknown_recipient' }
        };
      }
    } else {
      userId = userData.id;
    }

    // With userId resolved, proceed to find or create the source scoped to this user
    let source, isArchived;
    try {
      ({ source, isArchived } = await findOrCreateSource(fromEmail, fromName, client, userId as string));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Source limit reached')) {
        return { success: false, error: msg };
      }
      if (msg.includes('can_add_source error')) {
        return { success: false, error: msg };
      }
      throw err;
    }

    if (isArchived) {
      return {
        success: true,
        skipped: true,
        skipReason: 'source_archived',
        data: { skipped: true, reason: 'Source is archived' }
      };
    }

    const { data: canReceiveData, error: limitError } = await client.rpc(
      'can_receive_newsletter',
      {
        user_id_param: userId,
        title: emailData.subject,
        content: emailData['body-plain']
      }
    );

    if (!limitError && canReceiveData) {
      const canReceive = typeof canReceiveData === 'string'
        ? JSON.parse(canReceiveData)
        : canReceiveData;
      if (!canReceive.can_receive) {
        const skipReason = canReceive.reason || 'limit_reached';
        await client
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
      }
    }

    const { data, error } = await client.rpc(
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
      if ((error as any).message?.includes('duplicate') || (error as any).message?.includes('already exists')) {
        await client
          .from('skipped_newsletters')
          .insert({
            user_id: userId,
            title: emailData.subject,
            content: emailData['body-html'] || emailData['body-plain'],
            received_at: new Date().toISOString(),
            newsletter_source_id: source?.id,
            skip_reason: 'duplicate',
            skip_details: { from_email: fromEmail }
          });
        return {
          success: true,
          skipped: true,
          skipReason: 'duplicate',
          userId,
          data: { skipped: true, reason: 'duplicate' }
        };
      }
      return { success: false, error: (error as any).message || 'Unknown error' };
    }

    return { success: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Update findOrCreateSource function in handle-email/index.ts
async function findOrCreateSource(
  email: string,
  name: string,
  supabase: any,
  userId: string // Make userId required, not optional
): Promise<{ source: Source; created: boolean; isArchived: boolean }> {

  // Validate userId is provided
  if (!userId) {
    throw new Error('userId is required - all sources must be user-scoped');
  }

  // Find existing source by NAME only for this user
  const { data: sources, error: findError } = await supabase
    .from('newsletter_sources')
    .select('*')
    .eq('name', name)
    .eq('user_id', userId);

  if (findError) {
    console.error('Error finding source:', findError);
    throw new Error(`Failed to find source: ${findError.message}`);
  }

  if (sources && sources.length > 0) {
    // Source exists, update email if different
    const source = sources[0];
    if (source.from !== email) {
      const { error: updateError } = await supabase
        .from('newsletter_sources')
        .update({ from: email, updated_at: new Date().toISOString() })
        .eq('id', source.id);

      if (updateError) {
        console.error('Error updating source email:', updateError);
      }
    }

    return {
      source: { ...source, from: email },
      created: false,
      isArchived: source.is_archived || false
    };
  }

  // Check source limit
  const { data: canAddSource, error: sourceLimitError } = await supabase
    .rpc('can_add_source', { user_id_param: userId });

  if (sourceLimitError) {
    console.error('Error checking source limit:', sourceLimitError);
    throw new Error(`Failed to check source limit: ${sourceLimitError.message}`);
  }

  if (canAddSource === false) {
    throw new Error('Source limit reached for your subscription plan');
  }

  // Create new source
  const { data: newSource, error: createError } = await supabase
    .from('newsletter_sources')
    .insert([{
      from: email,
      name: name || email.split('@')[0],
      user_id: userId, // Always user-scoped
    }])
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

    // Mailgun provides HMAC digest as lowercase hex. Convert hex string to bytes.
    const signatureBuffer = hexToBytes(signature.trim());

    // Deno's type definitions for WebCrypto are strict about BufferSource being ArrayBuffer.
    // Convert Uint8Array views to ArrayBuffer instances for compatibility.
    const signatureArrayBuffer = toArrayBuffer(signatureBuffer);
    const dataArrayBuffer = toArrayBuffer(signatureBytes);

    // Verify the signature
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureArrayBuffer,
      dataArrayBuffer
    );

    return isValid;
  } catch (error) {
    console.error('Error verifying Mailgun webhook signature:', error);
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) {
    throw new Error('Invalid hex string length');
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = parseInt(normalized.substr(i, 2), 16);
  }
  return bytes;
}

// Convert a Uint8Array to a standalone ArrayBuffer (required for strict BufferSource typing in Deno)
function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
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
if (
  import.meta.main &&
  Deno.env.get('SUPABASE_ENVIRONMENT') !== 'production'
) {
  Deno.serve(handler);
}