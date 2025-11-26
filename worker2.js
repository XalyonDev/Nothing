// worker.js
const express = require("express");
const axios = require("axios");
const app = express();

app.use(express.json());

const TIMEOUT = 30000;

/* HELPERS */
function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function safeInt(x) {
  if (!x) return 0;
  const n = parseInt(String(x).replace(/[^0-9]/g, ""));
  return isNaN(n) ? 0 : n;
}

/* LOYALTY EXPIRE CHECK */
function checkLoyaltyExpiry(balanceRes) {
  try {
    const packs =
      balanceRes?.data?.attribute?.paclsPieData?.data?.packsList;

    if (!Array.isArray(packs)) return { found: false };

    const loyalty = packs.find(p => p?.title === "Loyalty Data Balance");

    if (!loyalty || !loyalty.expireAt) return { found: false };

    const exp = new Date(loyalty.expireAt);
    const now = new Date();
    const diff = (exp - now) / (1000 * 60 * 60 * 24);

    return {
      found: true,
      expireAt: loyalty.expireAt,
      daysLeft: diff,
      nearExpiry: diff < 2
    };
  } catch (e) {
    return { found: false };
  }
}

/* REDEEM 100MB */
async function redeemLoyaltyMB(phone, userid, token) {
  const url = `https://store.atom.com.mm/mytmapi/v1/my/point-system/redeem?msisdn=${phone}&userid=${userid}&v=4.13.0`;

  const payload = {
    title: "ဒေတာ ၁၀၀ MB ",
    rewardType: "telco",
    keyword: "100MB",
    partner: "ATOM",
    category: "data"
  };

  const headers = {
    "user-agent": "MyTM/4.13.0/Android/30",
    "device-name": "Xiaomi Redmi Note 8 Pro",
    "x-server-select": "production",
    "accept-encoding": "gzip",
    "authorization": `Bearer ${token}`,
    "content-type": "application/json"
  };

  try {
    const res = await axios.post(url, payload, {
      headers,
      timeout: TIMEOUT
    });

    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return {
      ok: false,
      status: err?.response?.status,
      error: err?.response?.data || err.message
    };
  }
}

/* FETCH BALANCE */
async function fetchBalance(phone, userid, token) {
  const url = `https://store.atom.com.mm/mytmapi/v1/my/lightweight-balance?msisdn=${phone}&userid=${userid}&v=4.13.0`;

  const headers = {
    "User-Agent": "MyTM/4.13.0/Android/30",
    "X-Server-Select": "production",
    "Device-Name": "Xiaomi Redmi Note 8 Pro",
    Authorization: `Bearer ${token}`
  };

  const res = await axios.get(url, { headers, timeout: TIMEOUT });
  return res.data;
}

/* POINTS */
async function fetchPoint(phone, userid, token) {
  const url = `https://store.atom.com.mm/mytmapi/v1/my/point-system/dashboard?msisdn=${phone}&userid=${userid}&v=4.13.0`;

  const headers = {
    "User-Agent": "MyTM/4.13.0/Android/30",
    Authorization: `Bearer ${token}`
  };

  const res = await axios.get(url, { headers, timeout: TIMEOUT });
  return (
    res.data?.data?.attribute?.totalPoint || "0"
  );
}

/* PROMO */
async function fetch40gPromo(phone, userid, token) {
  const url = `https://store.atom.com.mm/mytmapi/v1/my/packs/promo?tab=Data&msisdn=${phone}&userid=${userid}&v=4.13.0`;

  const headers = {
    "User-Agent": "MyTM/4.13.0/Android/30",
    Authorization: `Bearer ${token}`
  };

  const res = await axios.get(url, { headers, timeout: TIMEOUT });
  const list = res.data?.data?.attribute;

  if (Array.isArray(list)) {
    return list.some(p => p.offerId === "2999.54") ? 1 : 0;
  }
  return 0;
}

/* MAIN JOB ENDPOINT */
app.post("/run-job", async (req, res) => {
  const { phone, accessToken, userId } = req.body;

  if (!phone || !accessToken || !userId) {
    return res.status(400).json({ ok: false, error: "missing fields" });
  }

  try {
    // Fetch balance + data + bill
    const balanceRes = await fetchBalance(phone, userId, accessToken);

    const attr = balanceRes?.data?.attribute;

    // Mobile data
    let mobiledata = "0 MB";
    const packs = attr?.packsPieData?.data?.packsList;
    if (Array.isArray(packs) && packs.length > 0)
      mobiledata = packs[0]?.remainingAmount || "0 MB";

    // Bill
    const billValue = safeInt(attr?.mainBalance?.value);

    // Point
    const point = await fetchPoint(phone, userId, accessToken);

    // Promo
    const is40g = await fetch40gPromo(phone, userId, accessToken);

    // Loyalty check
    const loyalty = checkLoyaltyExpiry(balanceRes);

    let autoRedeem = null;

    if (loyalty.found && loyalty.nearExpiry) {
      autoRedeem = await redeemLoyaltyMB(phone, userId, accessToken);
    }

    return res.json({
      ok: true,
      mobiledata,
      bill: billValue,
      point,
      is40g,
      loyalty,
      autoRedeem
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "worker failed"
    });
  }
});

app.listen(7000, () => console.log("Worker running on port 7000"));
