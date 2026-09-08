const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const mime = require("mime");

const publicDir = path.join(__dirname, "public");
const port = process.env.PORT || 3000;
const dayInMilliseconds = 24 * 60 * 60 * 1000;
const priorities = new Set(["low", "medium", "high"]);
const apiPath = "/api/assignments";

let assignments = [];

const send = (response, status, data, type = "application/json") => {
	response.writeHead(status, {
		"Content-Type": `${type}; charset=utf-8`,
		"Cache-Control": "no-store",
	});
	response.end(type === "application/json" ? JSON.stringify(data) : data);
};

const parseDate = (value) => {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return null;
	}

	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
		? date
		: null;
};

// Both derived fields use values already present in the assignment.
const addDerivedFields = (assignment) => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const daysRemaining = Math.round(
		(parseDate(assignment.dueDate) - today) / dayInMilliseconds,
	);

	let urgency = "On track";
	if (daysRemaining < 0) urgency = "Overdue";
	else if (
		daysRemaining <= 2 ||
		(assignment.priority === "high" && daysRemaining <= 7)
	) {
		urgency = "Due soon";
	} else if (assignment.priority === "high") urgency = "High priority";

	return { ...assignment, daysRemaining, urgency };
};

const currentAssignments = () => {
	assignments = assignments.map(addDerivedFields);
	return assignments;
};

const validate = (input) => {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("Assignment data must be an object.");
	}

	const assignment = {
		title: typeof input.title === "string" ? input.title.trim() : "",
		course: typeof input.course === "string" ? input.course.trim() : "",
		dueDate: input.dueDate,
		priority: input.priority,
		hours: Number(input.hours),
	};

	if (!assignment.title || assignment.title.length > 100) {
		throw new Error(
			"Assignment name must be between 1 and 100 characters.",
		);
	}
	if (!assignment.course || assignment.course.length > 30) {
		throw new Error("Course must be between 1 and 30 characters.");
	}
	if (!parseDate(assignment.dueDate)) {
		throw new Error("Due date must be a valid date.");
	}
	if (!priorities.has(assignment.priority)) {
		throw new Error("Priority must be low, medium, or high.");
	}
	if (
		!Number.isFinite(assignment.hours) ||
		assignment.hours < 0.5 ||
		assignment.hours > 100 ||
		assignment.hours % 0.5 !== 0
	) {
		throw new Error(
			"Estimated hours must be between 0.5 and 100 in half-hour increments.",
		);
	}

	return assignment;
};

const readJson = (request) =>
	new Promise((resolve, reject) => {
		let body = "";
		request.on("data", (chunk) => (body += chunk));
		request.on("end", () => {
			try {
				resolve(JSON.parse(body));
			} catch {
				reject(new Error("Request body must be valid JSON."));
			}
		});
		request.on("error", reject);
	});

const methodNotAllowed = (response, allowed) => {
	response.setHeader("Allow", allowed);
	return send(response, 405, { error: "Method not allowed." });
};

const handleApi = async (request, response, pathname) => {
	if (pathname === apiPath) {
		if (request.method === "GET") {
			return send(response, 200, { assignments: currentAssignments() });
		}
		if (request.method !== "POST") {
			return methodNotAllowed(response, "GET, POST");
		}

		try {
			assignments.push(
				addDerivedFields({
					id: randomUUID(),
					...validate(await readJson(request)),
				}),
			);
			return send(response, 201, { assignments: currentAssignments() });
		} catch (error) {
			return send(response, 400, { error: error.message });
		}
	}

	const match = pathname.match(/^\/api\/assignments\/([^/]+)$/);
	if (!match) return send(response, 404, { error: "API route not found." });

	const index = assignments.findIndex(({ id }) => id === match[1]);
	if (index === -1) {
		return send(response, 404, { error: "Assignment not found." });
	}

	if (request.method === "DELETE") {
		assignments.splice(index, 1);
		return send(response, 200, { assignments: currentAssignments() });
	}

	if (request.method === "PUT") {
		try {
			assignments[index] = addDerivedFields({
				...assignments[index],
				...validate(await readJson(request)),
			});
			return send(response, 200, { assignments: currentAssignments() });
		} catch (error) {
			return send(response, 400, { error: error.message });
		}
	}

	return methodNotAllowed(response, "PUT, DELETE");
};

const serveFile = (response, pathname) => {
	const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
	const filename = path.resolve(publicDir, relativePath);

	if (!filename.startsWith(`${publicDir}${path.sep}`)) {
		return send(response, 403, "403 Error: Forbidden", "text/plain");
	}

	fs.readFile(filename, (error, content) => {
		if (error)
			return send(
				response,
				404,
				"404 Error: File Not Found",
				"text/plain",
			);
		response.writeHead(200, {
			"Content-Type":
				mime.getType(filename) || "application/octet-stream",
		});
		response.end(content);
	});
};

http.createServer(async (request, response) => {
	try {
		const pathname = decodeURIComponent(
			new URL(
				request.url,
				`http://${request.headers.host || "localhost"}`,
			).pathname,
		);

		if (pathname.startsWith("/api/")) {
			return await handleApi(request, response, pathname);
		}
		if (request.method !== "GET") {
			return methodNotAllowed(response, "GET");
		}
		return serveFile(response, pathname);
	} catch (error) {
		console.error(error);
		if (!response.headersSent) {
			return send(response, 500, {
				error: "The request could not be completed.",
			});
		}
	}
}).listen(port, () => {
	console.log(`Due Soon is running at http://localhost:${port}`);
});
