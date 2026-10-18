exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Spotify 환경 변수가 설정되지 않았습니다.' }) };
  }

  const q = (event.queryStringParameters?.q || '').trim();
  if (!q) return { statusCode: 400, headers, body: JSON.stringify({ error: '검색어를 입력하세요.' }) };

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Spotify 인증에 실패했습니다.', detail: tokenData.error_description || tokenData.error || '' }) };
    }

    const searchUrl = new URL('https://api.spotify.com/v1/search');
    searchUrl.searchParams.set('q', q);
    searchUrl.searchParams.set('type', 'artist');
    searchUrl.searchParams.set('limit', '8');
    const response = await fetch(searchUrl, {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const data = await response.json();
    if (!response.ok) {
      return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Spotify 아티스트 검색에 실패했습니다.', detail: data.error?.message || '' }) };
    }

    const artists = (data.artists?.items || []).map(a => ({
      id: a.id,
      name: a.name,
      url: a.external_urls?.spotify || `https://open.spotify.com/artist/${a.id}`,
      image: a.images?.[0]?.url || '',
      followers: a.followers?.total || 0,
      genres: a.genres || []
    }));
    return { statusCode: 200, headers, body: JSON.stringify({ artists }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: '서버에서 Spotify 검색 중 오류가 발생했습니다.' }) };
  }
};
