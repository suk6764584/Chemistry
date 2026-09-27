-- Coupon / gift card code (the number under a barcode, a PIN): what gets typed in
-- or shown at the counter, kept apart from order and reservation numbers.
alter table items add column if not exists coupon_code text;
