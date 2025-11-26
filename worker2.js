// worker.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const CONNECTION_TIMEOUT_MS = 30000;

// Console colors (optional)
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

/* ========== HELPERS ========== */
function safeInt(str, def = 0) {
  if (str == null) return def;
  const n = parseInt(String(str).replace(/[^0-9]/g, ""), 10);
  return Number.isNaN(n) ? def : n;
}

/* ========== BALANCE / DATA / BILL ========== */
async function fetchBalance(phone, userId, accessToken) {
  const url = `https://store.atom.com.mm/mytmapi/v1/my/lightweight-balance?msisdn=${phone}&userid=${userId}&v=4.13.0`;

  const headers = {
    "User-Agent": "MyTM/4.13.0/Android/30",
    "X-Server-Select": "production",
    "Device-Name": "Xiaomi Redmi Note 8 Pro",
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };

  const res = await axios.get(url, { headers, timeout: CONNECTION_TIMEOUT_MS });
  const json = res.data;

  const attr = json?.data?.attribute;

  // Mobile data
  let mobiledata = "0 MB";
  const packs = attr?.packsPieData;
  const dataSection = packs?.data;

  if (dataSection?.packsList?.length > 0) {
    const pack = dataSection.packsList[0];
    mobiledata = `${pack?.remainingAmount || 0}`;
  }

  // Bill
  let balanceValue = attr?.mainBalance?.value;
  if (balanceValue == null) balanceValue = "0";
  balanceValue = balanceValue.toString();

  const billInt = safeInt(balanceValue, 0);

  return { mobiledata, billInt };
}

/* ========== POINT ========== */
async function fetchPoint(phone, userId, accessToken) {
  const url = `https://store.atom.com.mm/mytmapi/v1/my/point-system/dashboard?msisdn=${phone}&userid=${userId}&v=4.13.0`;

  const headers = {
    "User-Agent": "MyTM/4.13.0/Android/30",
    "X-Server-Select": "production",
    "Device-Name": "Xiaomi Redmi Note 8 Pro",
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`
  };

  const res = await axios.get(url, { headers, timeout: CONNECTION_TIMEOUT_MS });
  const json = res.data;

  const pointValue = json?.data?.attribute?.totalPoint || "0";

  return pointValue;
}

/* ========== 40G PROMO ========== */
async function fetch40gPromo(phone, userId, accessToken) {
  const url = `https://store.atom.com.mm/mytmapi/v1/my/packs/promo?tab=Data&msisdn=${phone}&userid=${userId}&v=4.13.0`;

  const headers = {
    "User-Agent": "MyTM/4.13.0/Android/30",
    "X-Server-Select": "production",
    "Device-Name": "Xiaomi Redmi Note 8 Pro",
    "Accept-Encoding": "gzip",
    Authorization: `Bearer ${accessToken}`
  };

  const res = await axios.get(url, { headers, timeout: CONNECTION_TIMEOUT_MS });
  const json = res.data;

  const list = json?.data?.attribute;
  let is40g = 0;

  if (Array.isArray(list)) {
    is40g = list.some((item) => item.offerId === "2999.54") ? 1 : 0;
  }

  return is40g;
}

/* ========== MAIN JOB HANDLER ========== */
app.post("/run-job", async (req, res) => {
  const { phone, accessToken, userId } = req.body || {};

  if (!phone || !accessToken || !userId) {
    return res.status(400).json({ ok: false, error: "Missing phone/accessToken/userId" });
  }

  console.log(`${YELLOW}[JOB]${RESET} ${phone}`);

  try {
    const [balance, point, promo] = await Promise.all([
      fetchBalance(phone, userId, accessToken),
      fetchPoint(phone, userId, accessToken),
      fetch40gPromo(phone, userId, accessToken)
    ]);

    const mobiledata = balance.mobiledata;
    const bill = balance.billInt;
    const pointValue = point;
    const is40g = promo;

    console.log(`${GREEN}[OK]${RESET} ${phone} data=${mobiledata} bill=${bill} point=${pointValue} is40g=${is40g}`);

    return res.status(200).json({
      ok: true,
      phone,
      mobiledata,
      bill,
      point: pointValue,
      is40g
    });
  } catch (err) {
    const status = err.response?.status || 500;
    console.log(`${RED}[ERROR]${RESET} ${phone} → ${status} ${err.message}`);
    return res.status(status).json({
      ok: false,
      phone,
      error: err.message || "Worker error"
    });
  }
});

/* ========== START SERVER ========== */
const PORT = 7000;
app.listen(PORT, () => {
  console.log(`${GREEN}Worker listening on port ${PORT}${RESET}`);
});
