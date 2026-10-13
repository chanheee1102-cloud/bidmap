import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheLife } from "next/cache";
import type { Board, Firm } from "./types";

// 지금은 파이썬이 내보낸 JSON 파일을 읽는다(python -m bidmap export).
// 운영에 올릴 때 이 두 함수의 속만 DB 조회로 바꾸면 화면은 그대로다.
const DATA_DIR = path.join(process.cwd(), "data");

export async function getBoard(): Promise<Board> {
  "use cache";
  cacheLife("minutes");
  return JSON.parse(await readFile(path.join(DATA_DIR, "board.json"), "utf-8"));
}

export async function getFirms(): Promise<Firm[]> {
  "use cache";
  cacheLife("minutes");
  return JSON.parse(await readFile(path.join(DATA_DIR, "firms.json"), "utf-8"));
}
