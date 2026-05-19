import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { accessToken, adAccountId, since, until } = await request.json();

    if (!accessToken || !adAccountId) {
      return NextResponse.json({ error: 'Missing accessToken or adAccountId' }, { status: 400 });
    }

    // Determine the time_range query parameter
    let timeRangeQuery = '';
    if (since && until) {
      timeRangeQuery = `&time_range={'since':'${since}','until':'${until}'}`;
    } else {
      timeRangeQuery = `&date_preset=maximum`;
    }

    // Fetch campaigns and their insights
    // We use insights level to get the spend
    // Facebook API endpoint: 
    // GET /act_{adAccountId}/campaigns?fields=name,insights{spend}&limit=500
    // Format the adAccountId to ensure it starts with act_
    const formattedAdAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;

    const url = `https://graph.facebook.com/v19.0/${formattedAdAccountId}/insights?level=campaign&fields=campaign_name,campaign_id,spend&limit=500${timeRangeQuery}&access_token=${accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Meta API Error:', data.error);
      return NextResponse.json({ error: data.error.message }, { status: 400 });
    }

    // data.data contains an array of campaign insights
    const campaigns = data.data.map((insight: any) => ({
      campaign_id: insight.campaign_id,
      campaign_name: insight.campaign_name,
      spend: parseFloat(insight.spend || '0'),
    }));

    // Pagination (if more than 500 campaigns) - keeping it simple for now, usually 500 is enough for active insights
    
    return NextResponse.json({ campaigns });
  } catch (error: any) {
    console.error('Error fetching meta campaigns:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
