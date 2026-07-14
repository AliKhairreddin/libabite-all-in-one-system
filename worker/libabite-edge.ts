const CUSTOMER_SITE_URL = "https://libabite-order.thatcanadian.dev";
const STAFF_APP_URL = "https://libabite-work.thatcanadian.dev";
const CONVEX_URL = "https://useful-anaconda-961.convex.cloud";

const SECURITY_HEADERS = {
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(self), payment=(self)",
  "cross-origin-opener-policy": "same-origin"
};

function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...SECURITY_HEADERS,
      ...init.headers
    }
  });
}

function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "cache-control": "no-store",
      ...SECURITY_HEADERS
    }
  });
}

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "libabite-edge",
        customerSiteUrl: CUSTOMER_SITE_URL,
        staffAppUrl: STAFF_APP_URL,
        convexUrl: CONVEX_URL,
        checkedAt: new Date().toISOString()
      });
    }

    if (url.pathname === "/staff") {
      return redirect(STAFF_APP_URL);
    }

    if (url.pathname === "/order") {
      return redirect(`${CUSTOMER_SITE_URL}/?order=website`);
    }

    if (url.pathname === "/reserve") {
      return redirect(`${CUSTOMER_SITE_URL}/?reservation=website`);
    }

    return redirect(CUSTOMER_SITE_URL);
  }
};
