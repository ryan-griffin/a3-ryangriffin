let assignments = [];
let editingId = null;

const rows = document.querySelector("#assignment-rows");
const caption = document.querySelector("#results-caption");
const form = document.querySelector("#assignment-form");
const formTitle = document.querySelector("#form-title");
const saveButton = document.querySelector("#save-button");
const cancelButton = document.querySelector("#cancel-button");

const entities = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#039;",
};
const escapeHtml = (value) =>
	String(value).replace(/[&<>"']/g, (character) => entities[character]);

const request = async (url, options) => {
	const response = await fetch(url, options);
	const data = await response.json();
	if (!response.ok) throw new Error(data.error || "Request failed.");
	return data;
};

const render = () => {
	caption.textContent = `${assignments.length} assignment${assignments.length === 1 ? "" : "s"} tracked`;
	rows.innerHTML = assignments.length
		? assignments
				.map(
					(assignment) => `
		<tr>
			<th scope="row">${escapeHtml(assignment.title)}</th>
			<td>${escapeHtml(assignment.course)}</td>
			<td>${assignment.dueDate}</td>
			<td>${assignment.daysRemaining} days</td>
			<td>${assignment.hours} hours</td>
			<td>${assignment.priority}</td>
			<td>${assignment.urgency}</td>
			<td><button class="row-button" type="button" data-action="edit" data-id="${assignment.id}">Edit</button><button class="row-button" type="button" data-action="delete" data-id="${assignment.id}">Delete</button></td>
		</tr>`,
				)
				.join("")
		: '<tr><td id="table-message" colspan="8">No assignments yet. Add one using the form.</td></tr>';
};

const useServerData = ({ assignments: updatedAssignments }) => {
	assignments = updatedAssignments;
	render();
};

const resetForm = () => {
	editingId = null;
	form.reset();
	formTitle.textContent = "Add an assignment";
	saveButton.textContent = "Add assignment";
	cancelButton.hidden = true;
};

const editAssignment = (id) => {
	const assignment = assignments.find((item) => item.id === id);
	if (!assignment) return;

	editingId = id;
	["title", "course", "dueDate", "hours", "priority"].forEach((name) => {
		form.elements[name].value = assignment[name];
	});
	formTitle.textContent = "Update an assignment";
	saveButton.textContent = "Save changes";
	cancelButton.hidden = false;
	form.elements.title.focus();
};

const deleteAssignment = async (id) => {
	try {
		useServerData(
			await request(`/api/assignments/${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
		);
		if (editingId === id) resetForm();
	} catch (error) {
		alert(error.message);
	}
};

form.addEventListener("submit", async (event) => {
	event.preventDefault();
	const id = editingId;
	const endpoint = id
		? `/api/assignments/${encodeURIComponent(id)}`
		: "/api/assignments";

	saveButton.disabled = true;
	saveButton.textContent = "Saving...";
	try {
		useServerData(
			await request(endpoint, {
				method: id ? "PUT" : "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(Object.fromEntries(new FormData(form))),
			}),
		);
		resetForm();
	} catch (error) {
		alert(error.message);
	} finally {
		saveButton.disabled = false;
		saveButton.textContent = editingId ? "Save changes" : "Add assignment";
	}
});

cancelButton.addEventListener("click", resetForm);
rows.addEventListener("click", (event) => {
	const button = event.target.closest("button[data-action]");
	if (!button) return;
	if (button.dataset.action === "edit") editAssignment(button.dataset.id);
	if (button.dataset.action === "delete") deleteAssignment(button.dataset.id);
});

request("/api/assignments")
	.then(useServerData)
	.catch(() => {
		caption.textContent = "Unable to load assignments";
		rows.innerHTML =
			'<tr><td id="table-message" class="error" colspan="8">Could not reach the server. Reload to try again.</td></tr>';
	});
