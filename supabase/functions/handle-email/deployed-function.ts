import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10';
export default async function handler(req, supabaseClient) {
  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  // Handle POST requests
  if (req.method === 'POST') {
    try {
      let emailData = null;
      const contentType = req.headers.get('content-type') || '';
      const contentLength = req.headers.get('content-length') || 'unknown';
      console.log('[handle-email] Incoming POST', {
        contentType,
        contentLength
      });
      let parsePath = 'none';
      // We will try multiple parsing strategies to be robust against missing/incorrect content-type
      // 1) JSON when content-type indicates JSON
      if (!emailData && contentType.includes('application/json')) {
        try {
          const jsonData = await req.clone().json();
          emailData = {
            to: jsonData.recipient || jsonData.to,
            from: jsonData.from,
            subject: jsonData.subject,
            'body-html': jsonData['body-html'] || jsonData.html || '',
            'body-plain': jsonData['body-plain'] || jsonData.text || '',
            'message-headers': jsonData['message-headers'] || `From: ${jsonData.from}\nTo: ${jsonData.recipient || jsonData.to}\nSubject: ${jsonData.subject}`
          };
          parsePath = 'json';
        } catch (e) {
          console.warn('JSON parse failed; will attempt form/text parsing');
        }
      }
      // 2) FormData (works for multipart/form-data and x-www-form-urlencoded)
      if (!emailData) {
        try {
          const fd = await req.clone().formData();
          emailData = {
            to: fd.get('recipient') || fd.get('to') || '',
            from: fd.get('from') || '',
            subject: fd.get('subject') || '',
            'body-plain': fd.get('body-plain') || fd.get('text') || '',
            'body-html': fd.get('body-html') || fd.get('html') || '',
            'message-headers': fd.get('message-headers') || `From: ${fd.get('from')}\nTo: ${fd.get('recipient')}\nSubject: ${fd.get('subject')}`
          };
          parsePath = 'form';
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
            const get = (k) => params.get(k) || '';
            emailData = {
              to: get('recipient') || get('to'),
              from: get('from'),
              subject: get('subject'),
              'body-plain': get('body-plain') || get('text'),
              'body-html': get('body-html') || get('html'),
              'message-headers': get('message-headers') || `From: ${get('from')}\nTo: ${get('recipient')}\nSubject: ${get('subject')}`
            };
            parsePath = 'urlencoded';
          }
        } catch (_e) {
          // fallthrough
        }
      }
      if (!emailData) {
        console.warn('[handle-email] Unsupported or unparseable request body; returning 400', {
          contentType,
          contentLength
        });
        return new Response('Invalid request body', {
          status: 400,
          headers: {
            ...corsHeaders
          }
        });
      }
      console.log('[handle-email] Parsed emailData summary', {
        parsePath,
        hasTo: !!emailData.to,
        hasFrom: !!emailData.from,
        hasSubject: !!emailData.subject,
        bodyPlainLen: emailData['body-plain'] ? String(emailData['body-plain'].length) : '0',
        bodyHtmlLen: emailData['body-html'] ? String(emailData['body-html'].length) : '0'
      });
      // Verify the request is from Mailgun (in production) for form-encoded payloads only
      if (Deno.env.get('SUPABASE_ENVIRONMENT') === 'production') {
        // Attempt to extract signature fields from formData first, then URL-encoded fallback
        let signature = '';
        let token = '';
        let timestamp = '';
        let gotAny = false;
        try {
          const fd = await req.clone().formData();
          signature = fd.get('signature') || '';
          token = fd.get('token') || '';
          timestamp = fd.get('timestamp') || '';
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
          console.log('[handle-email] Mailgun signature fields present', {
            hasSignature: !!signature,
            hasToken: !!token,
            hasTimestamp: !!timestamp
          });
          if (!signature || !token || !timestamp) {
            console.error('[handle-email] Missing Mailgun signature parameters');
            return new Response('Missing Mailgun signature parameters', {
              status: 400,
              headers: {
                ...corsHeaders
              }
            });
          }
          const isValid = await verifyMailgunWebhook(token, timestamp, signature);
          if (!isValid) {
            console.error('[handle-email] Invalid Mailgun signature');
            return new Response('Invalid signature', {
              status: 403,
              headers: {
                ...corsHeaders
              }
            });
          }
          console.log('[handle-email] Mailgun signature verified');
        }
      }
      const supabase = supabaseClient || getSupabaseClient();
      console.log('[handle-email] About to call processIncomingEmail');
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('processIncomingEmail timeout after 25s')), 25000));
      const result = await Promise.race([
        processIncomingEmail(emailData, supabase),
        timeoutPromise
      ]);
      console.log('[handle-email] processIncomingEmail result', {
        success: result.success,
        error: result.error,
        skipped: result.skipped
      });
      if (result.error) {
        return new Response(JSON.stringify({
          error: result.error
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        data: result.data
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({
        error: 'Error processing request'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
  // Handle other HTTP methods
  return new Response(JSON.stringify({
    error: 'Method not allowed'
  }), {
    status: 405,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}
export async function processIncomingEmail(emailData, supabase) {
  let userId = null;
  let fromEmail = '';
  let fromName = '';
  try {
    console.log('[processIncomingEmail] Starting with emailData', {
      to: emailData.to,
      from: emailData.from,
      subject: emailData.subject
    });
    // Choose client: use injected if it looks valid, otherwise create a fresh one
    const client = supabase && typeof supabase.from === 'function' ? supabase : getSupabaseClient();
    console.log('[processIncomingEmail] Using client', {
      injected: !!supabase,
      validInjected: !!(supabase && typeof supabase.from === 'function')
    });
    if (!emailData.from || !emailData.to || !emailData.subject) {
      console.log('[processIncomingEmail] Missing required fields');
      return {
        success: false,
        error: 'Missing required email fields (from, to, or subject)'
      };
    }
    const fromMatch = emailData.from.match(/<?([^<>]+@[^>\s]+)>?/);
    fromEmail = fromMatch ? fromMatch[1] : emailData.from;
    fromName = emailData.from.replace(/<[^>]+>/g, '').trim();
    console.log('[processIncomingEmail] Extracted sender info', {
      fromEmail,
      fromName
    });
    let source, isArchived;
    try {
      console.log('[processIncomingEmail] About to findOrCreateSource');
      ({ source, isArchived } = await findOrCreateSource(fromEmail, fromName, client, userId));
      console.log('[processIncomingEmail] Source found/created', {
        sourceId: source?.id,
        isArchived
      });
    } catch (err) {
      console.log('[processIncomingEmail] findOrCreateSource error', {
        error: err instanceof Error ? err.message : String(err)
      });
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Source limit reached')) {
        return {
          success: false,
          error: msg
        };
      }
      if (msg.includes('can_add_source error')) {
        return {
          success: false,
          error: msg
        };
      }
      throw err;
    }
    if (isArchived) {
      return {
        success: true,
        skipped: true,
        skipReason: 'source_archived',
        data: {
          skipped: true,
          reason: 'Source is archived'
        }
      };
    }
    // Take only the first recipient (before any comma)
    const firstRecipient = emailData.to.split(',')[0].trim();
    let userEmail;
    if (firstRecipient.includes('@')) {
      userEmail = firstRecipient;
    } else {
      userEmail = `${firstRecipient}@dzapatariesco.dev`;
    }
    console.log('[processIncomingEmail] User email resolved', {
      userEmail,
      originalTo: emailData.to
    });
    const emailMatch = userEmail.match(/^([^@]+)@/);
    if (!emailMatch) {
      console.log('[processIncomingEmail] Invalid email format');
      return {
        success: false,
        error: 'Invalid recipient email format'
      };
    }
    const localPart = emailMatch[1];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(localPart)) {
      userId = localPart;
      console.log('[processIncomingEmail] User ID from UUID', {
        userId
      });
    } else {
      console.log('[processIncomingEmail] Looking up user by email alias');
      const { data: userData, error: userError } = await client.from('users').select('id').eq('email_alias', userEmail).single();
      if (userError || !userData) {
        console.log('[processIncomingEmail] User not found', {
          userError: userError?.message,
          userEmail
        });
        const fallbackUserId = Deno.env.get('DEFAULT_RECIPIENT_USER_ID') || '';
        if (fallbackUserId) {
          console.log('[processIncomingEmail] Using DEFAULT_RECIPIENT_USER_ID fallback');
          userId = fallbackUserId;
        } else {
          return {
            success: true,
            skipped: true,
            skipReason: 'unknown_recipient',
            skipDetails: {
              userEmail
            },
            userId: null,
            data: {
              skipped: true,
              reason: 'unknown_recipient'
            }
          };
        }
      }
      if (!userId) {
        userId = userData.id;
      }
      console.log('[processIncomingEmail] User found', {
        userId
      });
    }
    console.log('[processIncomingEmail] About to check can_receive_newsletter');
    const { data: canReceiveData, error: limitError } = await client.rpc('can_receive_newsletter', {
      user_id_param: userId,
      title: emailData.subject,
      content: emailData['body-plain']
    });
    console.log('[processIncomingEmail] can_receive_newsletter result', {
      hasData: !!canReceiveData,
      hasError: !!limitError
    });
    if (!limitError && canReceiveData) {
      const canReceive = typeof canReceiveData === 'string' ? JSON.parse(canReceiveData) : canReceiveData;
      if (!canReceive.can_receive) {
        const skipReason = canReceive.reason || 'limit_reached';
        await client.from('skipped_newsletters').insert({
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
    console.log('[processIncomingEmail] About to call handle_incoming_email_transaction');
    const { data, error } = await client.rpc('handle_incoming_email_transaction', {
      p_user_id: userId,
      p_from_email: fromEmail,
      p_from_name: fromName,
      p_subject: emailData.subject,
      p_content: emailData['body-html'] || emailData['body-plain'],
      p_excerpt: emailData['body-plain']?.substring(0, 200) || '',
      p_raw_headers: JSON.stringify(emailData['message-headers'] || [])
    });
    console.log('[processIncomingEmail] handle_incoming_email_transaction result', {
      hasData: !!data,
      hasError: !!error
    });
    if (error) {
      if (error.message?.includes('duplicate') || error.message?.includes('already exists')) {
        await client.from('skipped_newsletters').insert({
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
          data: {
            skipped: true,
            reason: 'duplicate'
          }
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
    if (typeof userId === 'undefined') userId = null;
    if (userId) {
      try {
        await (supabase && typeof supabase.from === 'function' ? supabase : getSupabaseClient()).from('skipped_newsletters').insert({
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
      } catch (_logError) {
        // ignore
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      userId: userId || undefined
    };
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
      persistSession: false
    }
  });
}
async function findOrCreateSource(email, name, supabase, userId) {
  // Match on both 'from' (email) and 'name' (title)
  const { data: sources, error: findError } = await supabase.from('newsletter_sources').select('*').ilike('from', email).ilike('name', name);
  if (findError) {
    console.error('Error finding source:', findError);
    throw new Error(`Failed to find source: ${findError.message}`);
  }
  if (sources && sources.length > 1) {
    // Multiple sources found for the same 'from' email and name
    const ids = sources.map((s) => s.id).join(', ');
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
    const { data: canAddSource, error: sourceLimitError } = await supabase.rpc('can_add_source', {
      user_id_param: userId
    });
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
  const { data: newSource, error: createError } = await supabase.from('newsletter_sources').insert([
    {
      from: email,
      name: name || email.split('@')[0],
      user_id: userId || null
    }
  ]).select().single();
  if (createError) {
    console.error('Error creating source:', createError);
    throw new Error(`Failed to create source: ${createError.message}`);
  }
  // After successfully creating a new source, increment the source count
  if (userId) {
    const { error: incrementError } = await supabase.rpc('increment_source_count', {
      user_id_param: userId
    });
    if (incrementError) {
      console.error('Error incrementing source count:', incrementError);
      // Don't fail the entire operation if incrementing fails, just log it
    }
  }
  return {
    source: newSource,
    created: true,
    isArchived: false
  };
}
/**
 * Verifies the signature of a Mailgun webhook request using POST body parameters
 */ async function verifyMailgunWebhook(token, timestamp, signature) {
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
    const key = await crypto.subtle.importKey('raw', keyData, {
      name: 'HMAC',
      hash: 'SHA-256'
    }, false, [
      'verify'
    ]);
    // Create the signature string to verify
    const signatureData = `${timestamp}${token}`;
    const signatureBytes = encoder.encode(signatureData);
    // Mailgun provides HMAC digest as lowercase hex. Convert hex string to bytes.
    const signatureBuffer = hexToBytes(signature.trim());
    // Verify the signature
    const isValid = await crypto.subtle.verify('HMAC', key, signatureBuffer, signatureBytes);
    return isValid;
  } catch (error) {
    console.error('Error verifying Mailgun webhook signature:', error);
    return false;
  }
}
function hexToBytes(hex) {
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
// Helper function to parse message headers string into an object
function parseMessageHeaders(headersString) {
  const headers = {};
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
if (import.meta.main && Deno.env.get('SUPABASE_ENVIRONMENT') !== 'production') {
  Deno.serve(handler);
}
