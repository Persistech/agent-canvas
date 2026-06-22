import { CheckboxGroup, Checkbox } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { Typography } from "#/ui/typography";
import { I18nKey } from "#/i18n/declaration";

interface McpServerRefsSelectProps {
  /** Names of the user's currently configured MCP servers (mcp_config keys). */
  availableServers: string[];
  /**
   * `null` = all configured servers (incl. ones added later); `[]` = none; a
   * non-null list = exactly the named servers. Mirrors
   * `AgentProfile.mcp_server_refs`.
   */
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}

/**
 * Tri-state selector for `mcp_server_refs`, rendered as a checkbox list with a
 * master "All servers" checkbox. Checking "All servers" ticks every box and
 * stores `null` (use all configured servers, including ones added later);
 * unchecking it clears to `[]`. Toggling individual boxes stores the explicit
 * name list — except re-ticking every configured server canonicalizes back to
 * `null`, so the all-checked state keeps tracking future servers. Dangling refs
 * (previously selected, no longer configured) stay checked so they round-trip
 * and are flagged below; a still-dangling ref hard-errors at resolve/launch.
 */
export function McpServerRefsSelect({
  availableServers,
  value,
  onChange,
}: McpServerRefsSelectProps) {
  const { t } = useTranslation("openhands");

  // Configured servers plus any still-referenced-but-removed names, so the
  // selection round-trips a dangling ref instead of silently dropping it.
  const danglingRefs = (value ?? []).filter(
    (name) => !availableServers.includes(name),
  );
  const options = [...availableServers, ...danglingRefs];

  // What the list shows as checked: everything when `null` (all servers).
  const selected = value ?? options;
  // The master checkbox is "checked" for `null` or an explicit list that already
  // covers every configured server (with no dangling ref); "indeterminate" for a
  // partial selection; "unchecked" for none.
  const allChecked =
    value === null ||
    (danglingRefs.length === 0 &&
      availableServers.length > 0 &&
      availableServers.every((name) => value.includes(name)));
  const someChecked = !allChecked && selected.length > 0;

  // Store the explicit list, collapsing "every configured server" back to the
  // dynamic `null` so the all-checked state keeps tracking future servers.
  const commitSelection = (next: string[]) => {
    const coversAllConfigured =
      next.length === availableServers.length &&
      availableServers.every((name) => next.includes(name));
    onChange(coversAllConfigured ? null : next);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="mcp-server-refs-select">
      <div className="flex flex-col gap-1">
        <Typography.Text className="text-sm font-medium text-white">
          {t(I18nKey.SETTINGS$AGENT_PROFILE_MCP_REFS_LABEL)}
        </Typography.Text>
        <Typography.Text className="text-xs text-[#717888]">
          {t(I18nKey.SETTINGS$AGENT_PROFILE_MCP_REFS_HINT)}
        </Typography.Text>
      </div>

      <Checkbox
        data-testid="mcp-server-refs-all"
        size="sm"
        isSelected={allChecked}
        isIndeterminate={someChecked}
        onValueChange={(checked) => onChange(checked ? null : [])}
      >
        <span className="text-sm text-white">
          {t(I18nKey.SETTINGS$AGENT_PROFILE_MCP_ALL_LABEL)}
        </span>
      </Checkbox>

      {options.length === 0 ? (
        <Typography.Text className="text-xs text-[#717888]">
          {t(I18nKey.SETTINGS$AGENT_PROFILE_MCP_NONE_AVAILABLE)}
        </Typography.Text>
      ) : (
        <CheckboxGroup
          value={selected}
          onValueChange={commitSelection}
          classNames={{ wrapper: "gap-2 pl-6" }}
        >
          {options.map((name) => (
            <Checkbox
              key={name}
              value={name}
              data-testid={`mcp-server-ref-${name}`}
              size="sm"
            >
              <span className="text-sm text-white">{name}</span>
            </Checkbox>
          ))}
        </CheckboxGroup>
      )}

      {danglingRefs.length > 0 && (
        <Typography.Text
          className="text-xs text-yellow-500"
          data-testid="mcp-server-refs-dangling"
        >
          {t(I18nKey.SETTINGS$AGENT_PROFILE_DANGLING_MCP, {
            names: danglingRefs.join(", "),
          })}
        </Typography.Text>
      )}
    </div>
  );
}
