const HCB_BASE = "https://hcb.hackclub.com";
const ORG_ID = "org_dku3Lx";

function ok(data, init = {}) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: init.status || 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      ...(init.headers || {}),
    },
  });
}

function err(error, status = 500, extra = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function normalizeTransaction(tx = {}) {
  const amountCents = Number(tx?.amount_cents);
  return {
    id: String(tx?.id || ""),
    memo: String(tx?.memo || "Transaction"),
    date: String(tx?.date || ""),
    amountCents: Number.isFinite(amountCents) ? amountCents : null,
    pending: !!tx?.pending,
    type: String(tx?.type || ""),
  };
}

export async function onRequestGet() {
  try {
    const [orgRes, txRes] = await Promise.all([
      fetch(`${HCB_BASE}/api/v3/organizations/${ORG_ID}`, {
        headers: { Accept: "application/json" },
      }),
      fetch(`${HCB_BASE}/api/v3/organizations/${ORG_ID}/transactions?per_page=6`, {
        headers: { Accept: "application/json" },
      }),
    ]);

    const orgData = await orgRes.json().catch(() => ({}));
    const txData = await txRes.json().catch(() => ([]));

    if (!orgRes.ok) {
      return err("HCB_ORG_FETCH_FAILED", 502, {
        status: orgRes.status,
        detail: orgData?.message || null,
      });
    }

    if (!txRes.ok) {
      return err("HCB_TX_FETCH_FAILED", 502, {
        status: txRes.status,
        detail: txData?.message || null,
      });
    }

    const balanceCents = Number(orgData?.balances?.balance_cents);
    const totalRaisedCents = Number(orgData?.balances?.total_raised);
    const feeBalanceCents = Number(orgData?.balances?.fee_balance_cents);
    const incomingBalanceCents = Number(orgData?.balances?.incoming_balance_cents);

    const transactions = Array.isArray(txData)
      ? txData.map(normalizeTransaction).slice(0, 6)
      : [];

    return ok({
      orgId: String(orgData?.id || ORG_ID),
      orgSlug: String(orgData?.slug || ""),
      orgName: String(orgData?.name || "Dual Power Gathering"),
      balanceCents: Number.isFinite(balanceCents) ? balanceCents : null,
      totalRaisedCents: Number.isFinite(totalRaisedCents) ? totalRaisedCents : null,
      feeBalanceCents: Number.isFinite(feeBalanceCents) ? feeBalanceCents : null,
      incomingBalanceCents: Number.isFinite(incomingBalanceCents) ? incomingBalanceCents : null,
      transactions,
      source: "hcb_api_v3",
    });
  } catch (e) {
    return err("HCB_FETCH_FAILED", 502, { detail: String(e?.message || e) });
  }
}
