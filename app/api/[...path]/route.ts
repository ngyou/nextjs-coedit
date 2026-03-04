import { NextRequest, NextResponse } from "next/server";

function buildUrl(path: string[], req: NextRequest): string {
  const base = process.env.API_URL;
  if (!base) throw new Error("API_URL is not configured");
  const p = path.join("/");
  const search = req.nextUrl.search ?? "";
  return `${base.replace(/\/+$/, "")}/${p}${search}`;
}

async function proxy(req: NextRequest, path: string[]) {
  const url = buildUrl(path, req);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  const upstream = await fetch(url, {
    method: req.method,
    headers: req.headers,
    body,
    cache: "no-store",
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(req, path);
}

