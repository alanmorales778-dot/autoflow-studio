-- Condiciones que ve el cliente en el link y en el estado de su pedido (cancelación, seña, tolerancia).
alter table public.bakeries add column if not exists policy_text text;
alter table public.bakeries drop constraint if exists bakeries_policy_text_len;
alter table public.bakeries add constraint bakeries_policy_text_len check (policy_text is null or char_length(policy_text) <= 600);
