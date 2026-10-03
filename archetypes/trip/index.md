---
title: "{{ replace .File.ContentBaseName "-" " " }}"
# the first day of the trip; trip-day numbers count from here
date: {{ .Date }}
type: trip
tags: [travel]
summary: ""
# photo capture times are bucketed into days in this timezone
timezone: Europe/Rome

# every place a trip-day route mentions. lat/lon are optional: leave them off and
# the place is positioned from the gps of photos taken the day you arrived.
# kind: city | port | anchorage | trail | waypoint (waypoint only bends a leg)
places: {}
#  rome:  { name: "rome", kind: city, lat: 41.9009, lon: 12.5016 }

# one trip-day per day in the body: self-closing for a one-line day, paired for a
# day you've written up. the paired form takes markdown plus
# {{ "{{<" }} photo id="..." {{ ">}}" }} and {{ "{{<" }} strava id="..." {{ ">}}" }}.
# see docs/trip-reports.md in the botufte theme.

# optional extra map views next to "whole trip"
# mapViews:
#   - name: "the interesting bit"
#     bounds: [[south, west], [north, east]]
---

a paragraph or two about the trip.

{{ "{{<" }} trip-day date="{{ .Date | time.Format "2006-01-02" }}" note="travel day" {{ "/>}}" }}
