const CUSTOMER_SITE_URL = "https://libabite-order.thatcanadian.dev";
const STAFF_APP_URL = "https://libabite-work.thatcanadian.dev";
const CONVEX_URL = "https://useful-anaconda-961.convex.cloud";

function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...init.headers
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
      return Response.redirect(STAFF_APP_URL, 302);
    }

    if (url.pathname === "/order") {
      return Response.redirect(`${CUSTOMER_SITE_URL}/?order=website`, 302);
    }

    if (url.pathname === "/reserve") {
      return Response.redirect(`${CUSTOMER_SITE_URL}/?reservation=website`, 302);
    }

    return Response.redirect(CUSTOMER_SITE_URL, 302);
  }
};
