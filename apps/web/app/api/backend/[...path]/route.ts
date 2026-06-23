import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const internalApiUrl =
  process.env.INTERNAL_API_URL ?? 'http://localhost:3000/api';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    },
  });
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  let targetUrl = '';

  try {
    const params = await context.params;
    const path = (params.path ?? []).map(encodeURIComponent).join('/');
    targetUrl = new URL(
      `${internalApiUrl.replace(/\/$/, '')}/${path}${request.nextUrl.search}`,
    ).toString();
    const headers = new Headers();
    const authorization = request.headers.get('authorization');
    const contentType = request.headers.get('content-type');
    const accept = request.headers.get('accept');

    if (authorization) {
      headers.set('Authorization', authorization);
    }

    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    if (accept) {
      headers.set('Accept', accept);
    }

    const hasBody = !['GET', 'HEAD'].includes(request.method);
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: 'no-store',
    });
    const responseBody = await response.text();
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get('content-type');

    if (responseContentType) {
      responseHeaders.set('Content-Type', responseContentType);
    }

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: 'Erro no proxy Next',
        error: error instanceof Error ? error.message : String(error),
        targetUrl,
      },
      { status: 502 },
    );
  }
}
