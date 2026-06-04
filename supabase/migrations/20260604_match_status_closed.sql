alter type match_status add value if not exists 'locked';
alter type match_status add value if not exists 'closed';

update matches
set status = 'closed'
where status::text = 'final';

update matches
set status = 'locked', locked = true
where status::text = 'scheduled';
