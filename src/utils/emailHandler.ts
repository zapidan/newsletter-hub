import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export interface IncomingEmail {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

export async function storeNewsletter(email: IncomingEmail) {
  try {
    // Extract the username from the 'to' address (format: username@newsletterhub.com)
    const [username] = email.to.split('@');
    
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
          from_email: email.from,
          subject: email.subject,
          content: email.html || email.text,
          received_at: new Date().toISOString(),
          is_read: false,
        },
      ])
      .select();

    if (error) {
      console.error('Error saving newsletter:', error);
      return { error };
    }

    return { data };
  } catch (error) {
    console.error('Error in storeNewsletter:', error);
    return { error };
  }
}

// Webhook handler for email services
export async function handleIncomingEmail(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let emailData;

    if (contentType.includes('application/json')) {
      emailData = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      emailData = Object.fromEntries(formData.entries());
    } else {
      return new Response('Unsupported content type', { status: 400 });
    }

    // Process the email data
    const email: IncomingEmail = {
      to: emailData.to || emailData.recipient || '',
      from: emailData.from || emailData.sender || '',
      subject: emailData.subject || 'No subject',
      text: emailData.text || emailData['stripped-text'] || '',
      html: emailData.html || emailData['stripped-html'] || '',
    };

    // Store the newsletter
    const result = await storeNewsletter(email);
    
    if (result.error) {
      return new Response(JSON.stringify({ error: 'Failed to store newsletter' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in handleIncomingEmail:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
