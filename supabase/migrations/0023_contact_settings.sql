-- Marketing site contact / WhatsApp (admin edits in dashboard → app_settings.contact_settings)

insert into public.app_settings (key, value)
values (
  'contact_settings',
  jsonb_build_object(
    'whatsapp_number', '919849078569',
    'phone_e164', '+919849078569',
    'phone_display', '+91 98490 78569',
    'whatsapp_enabled', true
  )
)
on conflict (key) do nothing;
