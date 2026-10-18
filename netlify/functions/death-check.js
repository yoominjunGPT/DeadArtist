
export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  };

  const name = new URL(request.url).searchParams.get("name")?.trim();

  if (!name) {
    return new Response(
      JSON.stringify({ error: "이름을 입력해 주세요." }),
      { status: 400, headers }
    );
  }

  try {
    const searchUrl = new URL(
      "https://www.wikidata.org/w/api.php"
    );

    searchUrl.search = new URLSearchParams({
      action: "wbsearchentities",
      search: name,
      language: "en",
      format: "json",
      type: "item",
      limit: "10"
    });

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) throw new Error("검색 실패");

    const searchData = await searchResponse.json();
    const results = searchData.search || [];

    const exact = results.filter(
      item => item.label?.toLowerCase() === name.toLowerCase()
    );

    const candidates = exact.length ? exact : results;

    for (const item of candidates) {
      const entityUrl = new URL(
        "https://www.wikidata.org/w/api.php"
      );

      entityUrl.search = new URLSearchParams({
        action: "wbgetentities",
        ids: item.id,
        props: "claims",
        format: "json"
      });

      const response = await fetch(entityUrl);
      if (!response.ok) continue;

      const data = await response.json();
      const entity = data.entities?.[item.id];
      const death = entity?.claims?.P570?.[0]
        ?.mainsnak?.datavalue?.value?.time;

      if (death) {
        return new Response(
          JSON.stringify({
            name,
            found: true,
            deceased: true,
            deathDate: death.replace(/^\+/, "").split("T")[0],
            source: "Wikidata",
            sourceUrl: `https://www.wikidata.org/wiki/${item.id}`
          }),
          { headers }
        );
      }
    }

    return new Response(
      JSON.stringify({
        name,
        found: candidates.length > 0,
        deceased: false,
        message: candidates.length
          ? "사망 기록을 찾지 못했습니다."
          : "일치하는 인물을 찾지 못했습니다."
      }),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "조회 중 오류가 발생했습니다." }),
      { status: 500, headers }
    );
  }
};
