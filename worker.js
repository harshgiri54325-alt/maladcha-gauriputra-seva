export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/create-order") {
      return createOrder(request, env);
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return Response.json({
        ok: true,
        service: "maladcha-gauriputra-seva"
      });
    }

    return env.ASSETS.fetch(request);
  }
};

async function createOrder(request, env) {
  try {
    const body = await request.json();

    const amount = Number(body.amount);
    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").replace(/\D/g, "");
    const email = String(body.email || "").trim();
    const seva = String(body.seva || "Community Seva").trim();

    if (!Number.isFinite(amount) || amount < 101 || amount > 1000000) {
      return Response.json(
        { error: "Invalid contribution amount." },
        { status: 400 }
      );
    }

    if (!name || !/^[0-9]{10}$/.test(phone)) {
      return Response.json(
        { error: "Valid name and 10-digit mobile number are required." },
        { status: 400 }
      );
    }

    const orderId = `MG-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const payload = {
      order_id: orderId,
      order_amount: Number(amount.toFixed(2)),
      order_currency: "INR",

      customer_details: {
        customer_id: `MG-${phone}`,
        customer_name: name.slice(0, 100),
        customer_phone: phone,
        ...(email
          ? { customer_email: email.slice(0, 100) }
          : {})
      },

      order_meta: {
        return_url:
          `${new URL(request.url).origin}/?payment=return&order_id=${encodeURIComponent(orderId)}`
      },

      order_note:
        `Utsav Se Seva - ${seva}`.slice(0, 200)
    };

    const response = await fetch(
      "https://api.cashfree.com/pg/orders",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2025-01-01",
          "x-client-id": env.CASHFREE_CLIENT_ID,
          "x-client-secret": env.CASHFREE_CLIENT_SECRET,
          "x-request-id": crypto.randomUUID(),
          "x-idempotency-key": crypto.randomUUID()
        },

        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Cashfree create order error:",
        response.status,
        data
      );

      return Response.json(
        { error: "Unable to create payment order." },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      order_id: data.order_id,
      payment_session_id: data.payment_session_id
    });

  } catch (error) {
    console.error("create-order error:", error);

    return Response.json(
      { error: "Server error while creating payment order." },
      { status: 500 }
    );
  }
}
