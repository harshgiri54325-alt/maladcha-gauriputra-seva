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

    if (!Number.isFinite(amount) || amount < 101) {
      return Response.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    if (!name || !/^[0-9]{10}$/.test(phone)) {
      return Response.json(
        { error: "Invalid name or phone" },
        { status: 400 }
      );
    }

    const orderId =
      `MG-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

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
          `${urlOrigin(request)}/?payment=return&order_id=${encodeURIComponent(orderId)}`
      },

      order_note: "Utsav Se Seva"
    };

    const response = await fetch(
      "https://api.cashfree.com/pg/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-api-version": "2025-01-01",
          "x-client-id": env.CASHFREE_CLIENT_ID,
          "x-client-secret": env.CASHFREE_CLIENT_SECRET,
          "x-request-id": crypto.randomUUID(),
          "x-idempotency-key": crypto.randomUUID()
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw_response: text };
    }

    if (!response.ok) {
      return Response.json(
        {
          ok: false,
          cashfree_status: response.status,
          cashfree_response: data
        },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      order_id: data.order_id,
      payment_session_id: data.payment_session_id
    });

  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

function urlOrigin(request) {
  return new URL(request.url).origin;
}
