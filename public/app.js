// app.js — the browser side. Plain JavaScript, no framework.
// Job: let the user pick images, show them, POST them to /api/convert, and
// download the PDF that comes back.

// Grab the elements we need from the page.
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const fileList = document.getElementById('fileList');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const status = document.getElementById('status');

// We keep the chosen files in our OWN array (not just the <input>) so we can:
//  - mix the file picker and drag-and-drop,
//  - ADD more files across several picks ("upload another"),
//  - remove a single file, or clear everything.
let selectedFiles = [];

// Vercel (and most serverless hosts) cap an upload request body at ~4.5 MB.
// We only enforce that cap when the app is running on a real host — when run
// locally there is NO size limit at all. This lets the live demo fail gracefully
// with a clear message instead of an opaque server error.
const HOSTED =
  location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
const HOSTED_MAX_BYTES = 4.3 * 1024 * 1024; // a little under 4.5 MB for safety

// Turn a byte count into something human ("1.4 MB").
function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Two files are "the same" if name + size + lastModified all match. Used to
// avoid adding the exact same photo twice if the user picks it again.
function isSameFile(a, b) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

// Add newly picked/dropped files to our list (skipping duplicates).
function addFiles(newFiles) {
  for (const file of newFiles) {
    if (!selectedFiles.some((existing) => isSameFile(existing, file))) {
      selectedFiles.push(file);
    }
  }
  // Reset the input so picking the SAME file again still fires "change".
  fileInput.value = '';
  setStatus('');
  renderFileList();
}

// Remove one file by its position in the list.
function removeFile(index) {
  selectedFiles.splice(index, 1);
  setStatus('');
  renderFileList();
}

// Clear the whole selection and start fresh.
function clearAll() {
  selectedFiles = [];
  fileInput.value = '';
  setStatus('');
  renderFileList();
}

// Redraw the list of chosen files and enable/disable the buttons.
function renderFileList() {
  fileList.innerHTML = '';

  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = file.name;

    const size = document.createElement('span');
    size.className = 'file-size';
    size.textContent = humanSize(file.size);

    // ✕ button to remove just this file.
    const remove = document.createElement('button');
    remove.className = 'file-remove';
    remove.type = 'button';
    remove.textContent = '✕';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.addEventListener('click', () => removeFile(index));

    li.append(name, size, remove);
    fileList.append(li);
  });

  const hasFiles = selectedFiles.length > 0;
  convertBtn.disabled = !hasFiles;
  clearBtn.disabled = !hasFiles;
}

// Set the status line with an optional style (error / success).
function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = `status ${kind}`;
}

// --- Picking files via the hidden <input> (adds to the list) ---
fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));

// --- The Clear all button ---
clearBtn.addEventListener('click', clearAll);

// --- Drag and drop onto the dropzone (also adds to the list) ---
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault(); // required so the browser allows a "drop"
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  addFiles(Array.from(e.dataTransfer.files));
});

// --- Convert: send the files and download the PDF ---
convertBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;

  // On a hosted (Vercel) deployment, block uploads over the serverless body
  // limit up front and tell the user how to handle large files (run locally).
  if (HOSTED) {
    const totalBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > HOSTED_MAX_BYTES) {
      setStatus(
        'This hosted demo caps total upload at ~4.5 MB. For larger files, run the tool locally (see the project README) — no limit there.',
        'error',
      );
      return;
    }
  }

  // Build the multipart body. The field name "images" MUST match the server's
  // upload.array('images').
  const formData = new FormData();
  for (const file of selectedFiles) formData.append('images', file);

  convertBtn.disabled = true;
  clearBtn.disabled = true;
  setStatus('Working… compressing and building your PDF.');

  try {
    const res = await fetch('/api/convert', { method: 'POST', body: formData });

    if (!res.ok) {
      // The server sends JSON like { error: "..." } on failure.
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Something went wrong.');
    }

    // Success: the body is the PDF. Turn it into a downloadable file.
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'images.pdf';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url); // free the temporary URL

    setStatus('Done! Your PDF downloaded. Clear to start a new one.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  } finally {
    // Re-enable the buttons (only if there are still files to act on).
    renderFileList();
  }
});
