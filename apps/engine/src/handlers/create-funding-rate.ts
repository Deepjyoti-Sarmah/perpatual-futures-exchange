export function calculateFundingRate(
  markPrice: number,
  indexPrice: number,
  cap = 0.0075,
) {
  if (markPrice <= 0 || indexPrice <= 0) {
    return 0;
  }

  const rawRate = (markPrice - indexPrice) / indexPrice;

  if (rawRate > cap) {
    return cap;
  }

  if (rawRate < -cap) {
    return -cap;
  }

  return rawRate;
}
