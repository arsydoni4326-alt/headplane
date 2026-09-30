import Dialog, { DialogPanel } from "~/components/dialog";
import Text from "~/components/text";
import Title from "~/components/title";
import type { Machine } from "~/types";

interface RotateKeyProps {
  machine: Machine;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function RotateKey({ machine, isOpen, setIsOpen }: RotateKeyProps) {
  return (
    <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
      <DialogPanel variant="destructive">
        <Title>Rotate key for {machine.givenName}</Title>
        <Text>
          This will invalidate the machine&apos;s current node key and disconnect it from your
          Tailnet. The device will need to re-authenticate to receive a new key. Use this when you
          suspect the key may have been compromised.
        </Text>
        <input name="action_id" type="hidden" value="rotate_key" />
        <input name="node_id" type="hidden" value={machine.id} />
      </DialogPanel>
    </Dialog>
  );
}
