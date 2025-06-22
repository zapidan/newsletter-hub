// This is a mock implementation of the email handler that can be used in tests
// It simulates the behavior of the actual Supabase function

interface EmailData {
  to: string;
  from: string;
  subject: string;
  'body-plain': string;
  'body-html': string;
  'message-headers'?: string;
  recipient?: string;
}

export async function emailHandler(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      const contentType = req.headers.get('content-type') || '';
      let emailData: EmailData;

      if (contentType.includes('application/json')) {
        const jsonData = await req.json();
        emailData = {
          to: jsonData.recipient || jsonData.to,
          from: jsonData.from,
          subject: jsonData.subject,
          'body-html': jsonData['body-html'] || jsonData.html || '',
          'body-plain': jsonData['body-plain'] || jsonData.text || '',
          'message-headers': jsonData['message-headers'] || ''
        };
      } else {
        const formData = await req.formData();
        emailData = {
          to: formData.get('recipient') as string || formData.get('to') as string || '',
          from: formData.get('from') as string || '',
          subject: formData.get('subject') as string || '',
          'body-plain': formData.get('body-plain') as string || '',
          'body-html': formData.get('body-html') as string || '',
          'message-headers': formData.get('message-headers') as string || ''
        };
      }

      // Basic validation
      if (!emailData.from || !emailData.to || !emailData.subject) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Simulate successful email processing
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (_error) {
      return new Response(JSON.stringify({ error: 'Error processing request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
