import type { MetadataRoute } from "next";

// 로그인을 붙이기 전까지는 검색 엔진이 긁어 가지 않게 한다.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
