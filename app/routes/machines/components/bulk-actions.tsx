import { Plus, TagsIcon, TimerOff, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import Dialog, { DialogPanel } from "~/components/dialog";
import Input from "~/components/input";
import TableList from "~/components/table-list";
import Text from "~/components/text";
import Title from "~/components/title";
import cn from "~/utils/cn";

interface BulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
  existingTags?: string[];
  policyTags?: string[];
  writable: boolean;
}

type Modal = "expire" | "delete" | "tags" | null;

export default function BulkActions({
  selectedIds,
  onClear,
  existingTags,
  policyTags,
  writable,
}: BulkActionsProps) {
  const fetcher = useFetcher();
  const submittingRef = useRef(false);
  const [modal, setModal] = useState<Modal>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tag, setTag] = useState("tag:");

  const count = selectedIds.length;
  const nodeIds = selectedIds.join(",");

  const tagIsInvalid = useMemo(
    () => tag.length === 0 || !tag.startsWith("tag:") || tags.includes(tag),
    [tag, tags],
  );

  const error = fetcher.data && !fetcher.data.success ? fetcher.data.error : null;

  useEffect(() => {
    if (fetcher.data?.success) {
      submittingRef.current = false;
      setModal(null);
      onClear();
    }

    if (fetcher.state === "idle" && fetcher.data && !fetcher.data.success) {
      submittingRef.current = false;
    }
  }, [fetcher.data, fetcher.state, onClear]);

  useEffect(() => {
    if (modal === "tags") {
      setTags([]);
      setTag("tag:");
    }
  }, [modal]);

  if (count === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 dark:border-indigo-800 dark:bg-indigo-950/40">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
          {count} {count === 1 ? "machine" : "machines"} selected
        </p>
        <div className="flex items-center gap-2">
          <Button disabled={!writable} onClick={() => setModal("expire")} variant="light">
            <TimerOff className="h-4 w-4" />
            Expire
          </Button>
          <Button disabled={!writable} onClick={() => setModal("delete")} variant="danger">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button disabled={!writable} onClick={() => setModal("tags")} variant="light">
            <TagsIcon className="h-4 w-4" />
            Tags
          </Button>
        </div>
        <button
          className="ml-auto flex items-center gap-1 text-sm font-medium text-mist-600 hover:text-mist-900 dark:text-mist-400 dark:hover:text-mist-100"
          onClick={onClear}
          type="button"
        >
          Clear selection
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog
        isOpen={modal === "expire"}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogPanel variant="destructive">
          <Title>
            Expire {count} {count === 1 ? "machine" : "machines"}
          </Title>
          <Text>
            This will disconnect the selected machines from your Tailnet. In order to reconnect,
            they will need to re-authenticate from the devices.
          </Text>
          <input name="action_id" type="hidden" value="batch_expire" />
          <input name="node_ids" type="hidden" value={nodeIds} />
        </DialogPanel>
      </Dialog>

      <Dialog
        isOpen={modal === "delete"}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogPanel variant="destructive">
          <Title>
            Remove {count} {count === 1 ? "machine" : "machines"}
          </Title>
          <Text>
            These machines will be permanently removed from your network. To re-add them, they will
            need to reauthenticate to your tailnet from the devices.
          </Text>
          <input name="action_id" type="hidden" value="batch_delete" />
          <input name="node_ids" type="hidden" value={nodeIds} />
        </DialogPanel>
      </Dialog>
      <Dialog
        isOpen={modal === "tags"}
        onOpenChange={(open) => {
          if (!open && submittingRef.current) {
            return;
          }
          setModal(open ? "tags" : null);
        }}
      >
        <DialogPanel
          isDisabled={fetcher.state !== "idle"}
          onSubmit={(event) => {
            event.preventDefault();
            submittingRef.current = true;
            const form = new FormData();
            form.set("action_id", "batch_update_tags");
            form.set("node_ids", nodeIds);
            form.set("tags", tags.filter((t) => t !== "").join(","));
            fetcher.submit(form, { method: "POST" });
          }}
        >
          <Title>
            Set ACL tags on {count} {count === 1 ? "machine" : "machines"}
          </Title>
          <Text>
            The tags below will replace the current tags on all selected machines. Tags need to be
            defined in your access control policy before they can be assigned.
          </Text>
          {error ? (
            <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          ) : null}
          <TableList className="mt-4">
            {tags.length === 0 ? (
              <TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
                <TagsIcon />
                <p className="font-semibold">No tags will be applied</p>
              </TableList.Item>
            ) : (
              tags.map((item) => (
                <TableList.Item className="font-mono" id={item} key={item}>
                  {item}
                  <Button
                    className="rounded-md p-0.5"
                    onClick={() => {
                      setTags(tags.filter((t) => t !== item));
                    }}
                    type="button"
                  >
                    <X className="p-1" />
                  </Button>
                </TableList.Item>
              ))
            )}
          </TableList>

          <div className="mt-2 flex items-center gap-2">
            <Input
              aria-label="Add a tag"
              className="w-full"
              value={tag}
              onChange={setTag}
              invalid={tag.length > 0 && tagIsInvalid}
              placeholder="tag:example"
              label="Tag"
              labelHidden
            />
            <Button
              className={cn("rounded-md p-1", tagIsInvalid && "opacity-50 cursor-not-allowed")}
              disabled={tagIsInvalid}
              onClick={() => {
                setTags([...tags, tag]);
                setTag("tag:");
              }}
              type="button"
            >
              <Plus className="p-1" size={30} />
            </Button>
          </div>
          {existingTags && existingTags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {existingTags
                .filter((option) => !tags.includes(option))
                .map((option) => (
                  <Button
                    className="px-2 py-1 font-mono text-xs"
                    key={option}
                    onClick={() => setTags([...tags, option])}
                    type="button"
                    variant="ghost"
                  >
                    {option}
                  </Button>
                ))}
            </div>
          ) : null}
          {policyTags !== undefined && tags.some((t) => !policyTags.includes(t)) ? (
            <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              {tags.filter((t) => !policyTags.includes(t)).join(", ")}{" "}
              {tags.filter((t) => !policyTags.includes(t)).length === 1 ? "is" : "are"} not declared
              under <code className="font-mono">tagOwners</code> in your policy, so no rule will
              match them. Declare them in{" "}
              <a className="underline" href="/acls">
                Access Control
              </a>
              .
            </p>
          ) : null}
        </DialogPanel>
      </Dialog>
    </>
  );
}
