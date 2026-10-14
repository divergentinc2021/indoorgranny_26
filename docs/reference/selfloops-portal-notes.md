# SelfLoops web portal — reference for the phase 2 rider portal

Observed 2026-10-14 from Laurent's own athlete account (member of team "Cadence Tygervalley", cadencecycling.co.za). Coach/studio-admin screens were not visible from an athlete login. These notes describe what the portal shows so the Granny Gear portal can offer the same, stripped to indoor cycling, in Granny Gear's look. No markup or code was copied.

## Navigation (athlete)
Home (dashboard) · Teams ▾ (my team, search teams) · Activities · Plans · Challenges · Performance ▾. Top bar: logged-in name → profile, Store, Chats, Settings, Help, Logout.

Keep for Granny Gear: Dashboard, My studio (team), Activities, Profile/Settings. Drop: Store, Chats, Plans, Challenges, Performance, multi-sport.

## Dashboard
- Three stat blocks: **This week** (activities, time, distance, each with a goal and % complete), **Year to date**, **All time** (activities, time, distance).
- Bar chart Mon–Sun, toggle Week / Year to date and Time / Distance.
- **Your health** card: overall feeling, weight, HRrest, HRmax, FTP, pace. "Update your weight" action. Each value editable in place.
- **Calendar** month view with activity chips (time of day, sport, duration, distance, avg HR, avg watts) and a weekly summary column (time, distance, TRIMP, training load, calories).

## Activities
- Tabs: List of activities · File uploads · Manual entry · Other methods.
- Filters: from/to date, sport, note text.
- Row: date + time, status (Available), sport (Training), duration, distance, avg HR, avg watts, training load, "How was your workout / How did you feel" prompts, **Download FIT**. Paginated.
- Activity detail page exists at `/activity/<id>` (the vendor app's autologin WebView pointed there).

## Profile / settings
- Tabs: Profile · Password · Privacy · Email notifications · Subscriptions-Payments · Applications · Group Fitness Sensors.
- Profile fields: first name, last name, username, nickname, birthdate, gender, height (cm), time zone, address, postal code, city, country, photo, short bio; display preferences (metric/imperial, language, telemetry colour, chart colours); performance preferences (elapsed vs moving time, training-load priority).
- **Applications**: Strava connected with "New activities will be uploaded on Strava" + Revoke; connectors for Withings, Garmin, Polar, Concept2, Wahoo, Coros, InBody, S10.run. This is where the studio's Strava auto-upload actually happened.
- **Group Fitness Sensors**: list of the rider's own heart-rate sensors (ADD SENSOR), i.e. the sensor-to-rider binding used in group classes.

## Team (studio) page
- Header: team name, tagline, city, country, website, join code, "member since", unsubscribe.
- Tabs: Classes (weekly/daily schedule) · Coaches.

## What phase 2 takes from this
- Rider record = vendor login response (weight, FTP, CP, W', HRmax, power zones) + portal profile basics (name, email, birthdate, gender, height, units) + HRrest.
- Rider-facing pages: dashboard (week/YTD/all-time, health card, calendar), activities list with FIT download and Strava status, profile with Strava connect/revoke, my sensors.
- Studio-facing pages (not observable here, built from the vendor app's needs): rider list with CSV import, edit-in-place, per-rider Strava link state, class schedule optional.
- Look: Granny Gear brand, not SelfLoops red. Single sport: indoor cycling.
