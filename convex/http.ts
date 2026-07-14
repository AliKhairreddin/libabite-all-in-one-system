import { httpRouter } from "convex/server";
import { mollieCheckout, stripeCheckout } from "./paymentWebhooks";

const http = httpRouter();

http.route({
  path: "/payments/stripe/webhook",
  method: "POST",
  handler: stripeCheckout
});

http.route({
  path: "/payments/mollie/webhook",
  method: "POST",
  handler: mollieCheckout
});

export default http;
