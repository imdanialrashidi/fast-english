export function orderTotal(quantity, unitPrice) {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError('quantity must be a positive integer');
  }
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new RangeError('unitPrice must be a non-negative number');
  }

  const discountRate = quantity > 10 ? 0.1 : 0;
  return Math.round(quantity * unitPrice * (1 - discountRate) * 100) / 100;
}
