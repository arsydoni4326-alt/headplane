const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

// validateRecordValue validates a DNS record value against its type.
// Returns an error message, or undefined when the value is valid.
export function validateRecordValue(type: string, value: string): string | undefined {
  if (type === "A") {
    if (!IPV4_RE.test(value)) {
      return "Enter a valid IPv4 address, e.g. 101.101.101.101";
    }
    const octets = value.split(".").map(Number);
    if (octets.some((octet) => octet > 255)) {
      return "Each IPv4 octet must be between 0 and 255";
    }
  }

  if (type === "AAAA") {
    if (!IPV6_RE.test(value)) {
      return "Enter a valid IPv6 address, e.g. 2001:db8::ff00:42:8329";
    }
  }

  if (type === "CNAME") {
    if (!value.includes(".")) {
      return "Enter a valid target domain, e.g. target.example.com";
    }
  }

  return undefined;
}