
export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  };

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers
    });

  const name = new URL(request.url)
    .searchParams.get("name")
    ?.trim();

  if (!name) {
    return json({ error: "이름을 입력해 주세요." }, 400);
  }

  try {
    const searchUrl = new URL(
      "https://www.wikidata.org/w/api.php"
    );

    searchUrl.search = new URLSearchParams({
      action: "wbsearchentities",
      search: name,
      language: "en",
      uselang: "en",
      format: "json",
      type: "item",
      limit: "10"
    });

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      throw new Error("Wikidata search failed");
    }

    const searchData = await searchResponse.json();
    const results = searchData.search || [];

    // 이름이 정확히 일치하는 인물만 확인합니다.
    const exact = results.filter(
      item =>
        item.label?.trim().toLocaleLowerCase("en") ===
        name.toLocaleLowerCase("en")
    );

    if (exact.length === 0) {
      return json({
        name,
        found: false,
        deceased: null,
        status: "not_verified",
        message: "이름이 정확히 일치하는 인물을 찾지 못했습니다."
      });
    }

    for (const item of exact) {
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

      // 정상적인 사망일 값이 있는지 확인합니다.
      const claims = entity?.claims?.P570 || [];

      const deathClaim = claims.find(claim =>
        claim.rank !== "deprecated" &&
        claim.mainsnak?.snaktype === "value" &&
        claim.mainsnak?.datavalue?.value?.time
      );

      const death = deathClaim?.mainsnak
        ?.datavalue?.value?.time;

      if (death) {
        const deathDate = death
          .replace(/^\+/, "")
          .split("T")[0];

        return json({
          name: item.label,
          found: true,
          deceased: true,
          status: "deceased",
          deathDate,
          source: "Wikidata",
          sourceUrl:
            `https://www.wikidata.org/wiki/${item.id}`
        });
      }
    }

    // 기록이 없다고 생존으로 단정하지 않습니다.
    return json({
      name,
      found: true,
      deceased: null,
      status: "unknown",
      message:
        "인물은 찾았지만 확인 가능한 사망 기록이 없습니다."
    });
  } catch (error) {
    return json({
      error: "사망정보 조회 중 오류가 발생했습니다."
    }, 500);
  }
};
