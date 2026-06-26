package processing

import (
	"fmt"
	"io"
	"strings"
	"time"
)

// intermediate struct for ICS parsing
type TempEvent struct {
	UID         string
	Title       string
	Description string
	Start       time.Time
	End         time.Time
}

// parse a standard iCalendar reader stream into clean temporary event objects
func ParseICS(r io.Reader) ([]TempEvent, error) {
	lines, err := unfoldICS(r)
	if err != nil {
		return nil, err
	}

	var events []TempEvent
	var cur *TempEvent

	for _, line := range lines {
		before, after, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		keyPart := before
		val := after

		tag := keyPart
		if before_tag, _, ok_tag := strings.Cut(keyPart, ";"); ok_tag {
			tag = before_tag
		}

		switch tag {
		case "BEGIN":
			if val == "VEVENT" {
				cur = &TempEvent{}
			}
		case "END":
			if val == "VEVENT" && cur != nil {
				// Validate required standard fields (UID, Title, Start)
				if cur.UID != "" && cur.Title != "" && !cur.Start.IsZero() {
					// Fallback end time
					if cur.End.IsZero() {
						cur.End = cur.Start
					}
					events = append(events, *cur)
				}
				cur = nil
			}
		case "UID":
			if cur != nil {
				cur.UID = strings.TrimSpace(val)
			}
		case "SUMMARY":
			if cur != nil {
				cur.Title = unescapeICSValue(strings.TrimSpace(val))
			}
		case "DESCRIPTION":
			if cur != nil {
				cur.Description = unescapeICSValue(strings.TrimSpace(val))
			}
		case "DTSTART":
			if cur != nil {
				if t, err := parseICSTime(line); err == nil {
					cur.Start = t
				}
			}
		case "DTEND":
			if cur != nil {
				if t, err := parseICSTime(line); err == nil {
					cur.End = t
				}
			}
		}
	}

	return events, nil
}

// unfolds iCalendar folded lines (which start with space or tab) and returns individual lines
func unfoldICS(r io.Reader) ([]string, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}

	// Normalize CRLF to LF
	content := string(data)
	content = strings.ReplaceAll(content, "\r\n", "\n")
	content = strings.ReplaceAll(content, "\r", "\n")

	rawLines := strings.Split(content, "\n")
	var lines []string
	for _, line := range rawLines {
		if line == "" {
			continue
		}
		// if line starts with space or tab, it continues the previous line
		if (strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t")) && len(lines) > 0 {
			lines[len(lines)-1] = lines[len(lines)-1] + line[1:]
		} else {
			lines = append(lines, line)
		}
	}
	return lines, nil
}

// Process standard iCalendar datetime strings
//
// It honors the optional TZID parameter (like DTSTART;TZID=America/New_York:...)
// by resolving it through Go's IANA timezone database (time.LoadLocation). 
// If theTZID is absent or cannot be resolved, the value is interpreted in the local
// timezone, matching the previous behavior for feeds without timezone metadata
//
// VTIMEZONE blocks are not parsed since most feeds emit IANA TZIDs, which are properly processed.
// Non-IANA identifiers (mostly legacy feeds) fall back to local time
func parseICSTime(line string) (time.Time, error) {
	// The value follows the first ":"; iCalendar datetime values never contain ":".
	before, after, ok := strings.Cut(line, ":")
	if !ok {
		return time.Time{}, fmt.Errorf("malformed calendar datetime line: %q", line)
	}
	keyPart := before
	val := strings.TrimSpace(after)

	// Resolve a TZID parameter from the property's parameter list.
	loc := time.Local
	for param := range strings.SplitSeq(keyPart, ";") {
		if name, tzid, ok := strings.Cut(param, "="); ok && name == "TZID" {
			if l, err := time.LoadLocation(strings.Trim(tzid, `"`)); err == nil {
				loc = l
			}
			break
		}
	}

	// UTC format: absolute instant; the Z suffix overrides any TZID.
	if strings.HasSuffix(val, "Z") {
		t, err := time.Parse("20060102T150405Z", val)
		if err != nil {
			return time.Time{}, err
		}
		return t.Local(), nil
	}

	//Date-time format: interpret in the resolved location.
	if strings.Contains(val, "T") {
		return time.ParseInLocation("20060102T150405", val, loc)
	}

	// date-only format: all-day event; location is irrelevant.
	if len(val) >= 8 {
		return time.ParseInLocation("20060102", val[:8], loc)
	}

	return time.Time{}, fmt.Errorf("unknown calendar date format: %q", val)
}

// unescapes standard iCalendar string values
func unescapeICSValue(s string) string {
	r := strings.NewReplacer(
		`\\`, `\`,
		`\,`, `,`,
		`\;`, `;`,
		`\N`, "\n",
		`\n`, "\n",
	)
	return r.Replace(s)
}
