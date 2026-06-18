-- AntrophAI invite-token redemption RPC
-- Use this after applying token-service/supabase/schema.sql.

create or replace function public.redeem_invite_token(
  p_token_hash text,
  p_grant_id text,
  p_client_build text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.invite_tokens%rowtype;
begin
  update public.invite_tokens
     set status = 'claimed',
         grant_id = p_grant_id,
         current_grant_id = p_grant_id,
         claim_count = coalesce(claim_count, 0) + 1,
         claimed_at = coalesce(claimed_at, now()),
         claimed_client_build = p_client_build,
         last_seen_at = now()
   where token_hash = p_token_hash
     and status = 'unused'
   returning * into v_row;

  if not found then
    select * into v_row
      from public.invite_tokens
     where token_hash = p_token_hash;

    if not found then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'token_invalid',
          'message', 'Invite token was not recognised.'
        )
      );
    end if;

    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code',
        case v_row.status
          when 'claimed' then 'token_claimed'
          when 'revoked' then 'token_revoked'
          when 'expired' then 'token_expired'
          else 'token_invalid'
        end,
        'message',
        case v_row.status
          when 'claimed' then 'Invite token was already claimed.'
          when 'revoked' then 'Invite token has been revoked.'
          when 'expired' then 'Invite token has expired.'
          else 'Invite token was not recognised.'
        end
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'grant', jsonb_build_object(
      'grantId', v_row.current_grant_id,
      'currentGrantId', v_row.current_grant_id,
      'tokenId', concat('tok_', v_row.id::text),
      'testerLabel', v_row.tester_label,
      'tokenHashPrefix', v_row.token_prefix,
      'issuedAt', v_row.claimed_at,
      'expiresAt', v_row.expires_at,
      'accessMode', 'invite-token',
      'claimCount', v_row.claim_count
    )
  );
end;
$$;
