-- Digital-goods use case: an order/link can opt out of the physical shipment
-- lifecycle (processing/packed/shipped) entirely. Defaults to true so every
-- existing link/order keeps requiring shipping unchanged.
alter table checkout_links add column requires_shipping boolean not null default true;
alter table orders add column requires_shipping boolean not null default true;
