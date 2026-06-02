alter table profiles
add column if not exists paid boolean not null default false;
