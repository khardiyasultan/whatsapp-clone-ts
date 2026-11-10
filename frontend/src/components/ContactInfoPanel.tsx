
type ContactInfoPanelProps = {
  name: string;
  messageCount: number;
  onClose: () => void;
};

function ContactInfoPanel({
  name,
  messageCount,
  onClose,
}: ContactInfoPanelProps) {
  return (
    <aside className="flex h-full w-[340px] shrink-0 flex-col border-l border-[#303d45] bg-[#111b21] text-[#e9edef] max-sm:absolute max-sm:inset-y-0 max-sm:right-0 max-sm:z-40 max-sm:w-full">
      {/* Panel header */}
      <div className="flex h-[70px] shrink-0 items-center gap-4 bg-[#202c33] px-4">
        <button
          type="button"
          aria-label="Close contact info"
          onClick={onClose}
          className="text-2xl text-[#aebac1] hover:text-white"
        >
          ×
        </button>

        <h2 className="font-medium">Contact info</h2>
      </div>

      {/* Contact profile */}
      <div className="flex flex-col items-center px-5 py-8">
        <div className="grid h-32 w-32 place-items-center rounded-full bg-[#6a8f85] text-5xl font-medium text-white">
          {name.charAt(0).toUpperCase()}
        </div>

        <h3 className="mt-4 text-xl font-medium">{name}</h3>

        <p className="mt-1 text-sm text-[#8696a0]">online</p>
      </div>

      {/* About section */}
      <div className="mx-4 rounded-lg bg-[#202c33] p-4">
        <p className="text-sm text-[#8696a0]">About</p>
        <p className="mt-2 text-sm">
          Hey there! I am using WhatsApp.
        </p>
      </div>

      {/* Chat details */}
      <div className="mx-4 mt-3 rounded-lg bg-[#202c33] p-4">
        <p className="text-sm text-[#8696a0]">Chat details</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm">Messages</span>
          <span className="text-sm text-[#8696a0]">
            {messageCount}
          </span>
        </div>
      </div>
    </aside>
  );
}

export default ContactInfoPanel;
