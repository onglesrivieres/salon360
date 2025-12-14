import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[${new Date().toISOString()}] Starting auto-approval process...`);

    const { data, error } = await supabase.rpc('auto_approve_with_monitoring', {
      p_source: 'edge_function'
    });

    const duration = Date.now() - startTime;

    if (error) {
      console.error(`[${new Date().toISOString()}] Error auto-approving tickets:`, error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          duration_ms: duration,
          timestamp: new Date().toISOString()
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const ticketsApproved = data?.count ?? 0;
    console.log(`[${new Date().toISOString()}] Auto-approval completed: ${ticketsApproved} ticket(s) approved in ${duration}ms`);
    
    if (ticketsApproved > 0) {
      console.log(`[${new Date().toISOString()}] Stores processed:`, data?.stores_processed);
    }

    return new Response(
      JSON.stringify({
        success: true,
        result: data,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        duration_ms: duration,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});