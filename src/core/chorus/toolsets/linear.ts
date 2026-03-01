import { Toolset } from "@core/chorus/Toolsets";
import { fetch } from "@tauri-apps/plugin-http";

const LINEAR_API_URL = "https://api.linear.app/graphql";

async function linearGraphQL(
    apiKey: string,
    query: string,
    variables?: Record<string, unknown>,
): Promise<unknown> {
    const response = await fetch(LINEAR_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: apiKey,
        },
        body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Linear API error (${response.status}): ${text}`);
    }

    const json = (await response.json()) as {
        data?: unknown;
        errors?: Array<{ message: string }>;
    };
    if (json.errors?.length) {
        throw new Error(
            `Linear GraphQL errors: ${json.errors.map((e) => e.message).join(", ")}`,
        );
    }

    return json.data;
}

function getApiKey(config: Record<string, unknown>): string {
    const key = config._apiKey as string | undefined;
    if (!key) {
        throw new Error(
            "Linear API key is not configured. Please add your API key in Settings > Connections > Linear.",
        );
    }
    return key;
}

export class ToolsetLinear extends Toolset {
    constructor() {
        super(
            "linear",
            "Linear",
            {
                apiKey: {
                    id: "apiKey",
                    displayName: "API Key",
                    type: "string",
                    isSecret: true,
                },
            },
            "Manage Linear issues, projects, and teams",
            "https://linear.app/settings/api",
        );

        this.addCustomTool(
            "search_issues",
            {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description:
                            "Search query to find issues. Searches title, description, and comments.",
                    },
                    limit: {
                        type: "integer",
                        description:
                            "Maximum number of results to return (default: 10, max: 50).",
                    },
                },
                required: ["query"],
                additionalProperties: false,
            },
            async (args) => {
                const apiKey = getApiKey(args);
                const query = args.query as string;
                const limit = Math.min((args.limit as number) || 10, 50);

                const data = (await linearGraphQL(
                    apiKey,
                    `
                    query SearchIssues($query: String!, $first: Int!) {
                        searchIssues(term: $query, first: $first) {
                            nodes {
                                id
                                identifier
                                title
                                description
                                priority
                                state { name }
                                assignee { name }
                                team { name key }
                                labels { nodes { name } }
                                url
                                createdAt
                                updatedAt
                            }
                        }
                    }
                    `,
                    { query, first: limit },
                )) as {
                    searchIssues: {
                        nodes: Array<Record<string, unknown>>;
                    };
                };

                const issues = data.searchIssues.nodes;
                if (issues.length === 0) {
                    return "No issues found matching your search.";
                }

                return JSON.stringify(issues, undefined, 2);
            },
            "Search for issues in Linear by keyword. Returns matching issues with their status, assignee, and other details.",
        );

        this.addCustomTool(
            "get_issue",
            {
                type: "object",
                properties: {
                    issueId: {
                        type: "string",
                        description:
                            "The issue identifier (e.g., 'ENG-123') or UUID.",
                    },
                },
                required: ["issueId"],
                additionalProperties: false,
            },
            async (args) => {
                const apiKey = getApiKey(args);
                const issueId = args.issueId as string;

                // Try identifier first (e.g., "ENG-123"), fall back to UUID
                const isIdentifier = /^[A-Z]+-\d+$/.test(issueId);

                const query = isIdentifier
                    ? `
                        query GetIssue($id: String!) {
                            issueSearch(filter: { identifier: { eq: $id } }, first: 1) {
                                nodes {
                                    id
                                    identifier
                                    title
                                    description
                                    priority
                                    priorityLabel
                                    state { name }
                                    assignee { name email }
                                    team { name key }
                                    labels { nodes { name } }
                                    comments { nodes { body user { name } createdAt } }
                                    url
                                    createdAt
                                    updatedAt
                                }
                            }
                        }
                    `
                    : `
                        query GetIssue($id: String!) {
                            issue(id: $id) {
                                id
                                identifier
                                title
                                description
                                priority
                                priorityLabel
                                state { name }
                                assignee { name email }
                                team { name key }
                                labels { nodes { name } }
                                comments { nodes { body user { name } createdAt } }
                                url
                                createdAt
                                updatedAt
                            }
                        }
                    `;

                const data = (await linearGraphQL(apiKey, query, {
                    id: issueId,
                })) as Record<string, unknown>;

                const issue = isIdentifier
                    ? (
                          data.issueSearch as {
                              nodes: Array<Record<string, unknown>>;
                          }
                      ).nodes[0]
                    : data.issue;

                if (!issue) {
                    return `Issue "${issueId}" not found.`;
                }

                return JSON.stringify(issue, undefined, 2);
            },
            "Get detailed information about a specific Linear issue, including comments.",
        );

        this.addCustomTool(
            "create_issue",
            {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "Title of the issue.",
                    },
                    description: {
                        type: "string",
                        description:
                            "Description of the issue (supports markdown).",
                    },
                    teamId: {
                        type: "string",
                        description:
                            "The team ID or key to create the issue in. Use list_teams to find available teams.",
                    },
                    priority: {
                        type: "integer",
                        description:
                            "Priority: 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low.",
                    },
                    assigneeId: {
                        type: "string",
                        description:
                            "UUID of the user to assign the issue to. Use list_teams to find team members.",
                    },
                },
                required: ["title", "teamId"],
                additionalProperties: false,
            },
            async (args) => {
                const apiKey = getApiKey(args);
                const title = args.title as string;
                const description = args.description as string | undefined;
                const teamId = args.teamId as string;
                const priority = args.priority as number | undefined;
                const assigneeId = args.assigneeId as string | undefined;

                // If teamId looks like a key (e.g., "ENG"), resolve it to UUID
                let resolvedTeamId = teamId;
                if (/^[A-Z]+$/.test(teamId)) {
                    const teamData = (await linearGraphQL(
                        apiKey,
                        `
                        query FindTeam($key: String!) {
                            teams(filter: { key: { eq: $key } }) {
                                nodes { id }
                            }
                        }
                        `,
                        { key: teamId },
                    )) as {
                        teams: { nodes: Array<{ id: string }> };
                    };
                    if (teamData.teams.nodes.length === 0) {
                        throw new Error(`Team with key "${teamId}" not found.`);
                    }
                    resolvedTeamId = teamData.teams.nodes[0].id;
                }

                const input: Record<string, unknown> = {
                    title,
                    teamId: resolvedTeamId,
                };
                if (description) input.description = description;
                if (priority !== undefined) input.priority = priority;
                if (assigneeId) input.assigneeId = assigneeId;

                const data = (await linearGraphQL(
                    apiKey,
                    `
                    mutation CreateIssue($input: IssueCreateInput!) {
                        issueCreate(input: $input) {
                            success
                            issue {
                                id
                                identifier
                                title
                                url
                                state { name }
                                team { name key }
                            }
                        }
                    }
                    `,
                    { input },
                )) as {
                    issueCreate: {
                        success: boolean;
                        issue: Record<string, unknown>;
                    };
                };

                if (!data.issueCreate.success) {
                    throw new Error("Failed to create issue.");
                }

                return JSON.stringify(data.issueCreate.issue, undefined, 2);
            },
            "Create a new issue in Linear.",
        );

        this.addCustomTool(
            "update_issue",
            {
                type: "object",
                properties: {
                    issueId: {
                        type: "string",
                        description:
                            "The issue identifier (e.g., 'ENG-123') or UUID.",
                    },
                    title: {
                        type: "string",
                        description: "New title for the issue.",
                    },
                    description: {
                        type: "string",
                        description: "New description for the issue.",
                    },
                    stateId: {
                        type: "string",
                        description:
                            "UUID of the new state. Use get_issue to see current state.",
                    },
                    priority: {
                        type: "integer",
                        description:
                            "Priority: 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low.",
                    },
                    assigneeId: {
                        type: "string",
                        description: "UUID of the user to assign the issue to.",
                    },
                },
                required: ["issueId"],
                additionalProperties: false,
            },
            async (args) => {
                const apiKey = getApiKey(args);
                const issueId = args.issueId as string;

                // Resolve identifier to UUID if needed
                let resolvedId = issueId;
                if (/^[A-Z]+-\d+$/.test(issueId)) {
                    const searchData = (await linearGraphQL(
                        apiKey,
                        `
                        query FindIssue($id: String!) {
                            issueSearch(filter: { identifier: { eq: $id } }, first: 1) {
                                nodes { id }
                            }
                        }
                        `,
                        { id: issueId },
                    )) as {
                        issueSearch: { nodes: Array<{ id: string }> };
                    };
                    if (searchData.issueSearch.nodes.length === 0) {
                        throw new Error(`Issue "${issueId}" not found.`);
                    }
                    resolvedId = searchData.issueSearch.nodes[0].id;
                }

                const input: Record<string, unknown> = {};
                if (args.title) input.title = args.title;
                if (args.description) input.description = args.description;
                if (args.stateId) input.stateId = args.stateId;
                if (args.priority !== undefined) input.priority = args.priority;
                if (args.assigneeId) input.assigneeId = args.assigneeId;

                const data = (await linearGraphQL(
                    apiKey,
                    `
                    mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
                        issueUpdate(id: $id, input: $input) {
                            success
                            issue {
                                id
                                identifier
                                title
                                url
                                state { name }
                                assignee { name }
                            }
                        }
                    }
                    `,
                    { id: resolvedId, input },
                )) as {
                    issueUpdate: {
                        success: boolean;
                        issue: Record<string, unknown>;
                    };
                };

                if (!data.issueUpdate.success) {
                    throw new Error("Failed to update issue.");
                }

                return JSON.stringify(data.issueUpdate.issue, undefined, 2);
            },
            "Update an existing Linear issue. You can change its title, description, state, priority, or assignee.",
        );

        this.addCustomTool(
            "list_teams",
            {
                type: "object",
                properties: {},
                additionalProperties: false,
            },
            async (args) => {
                const apiKey = getApiKey(args);

                const data = (await linearGraphQL(
                    apiKey,
                    `
                    query ListTeams {
                        teams {
                            nodes {
                                id
                                name
                                key
                                members {
                                    nodes {
                                        id
                                        name
                                        email
                                    }
                                }
                                states {
                                    nodes {
                                        id
                                        name
                                        type
                                    }
                                }
                            }
                        }
                    }
                    `,
                )) as {
                    teams: { nodes: Array<Record<string, unknown>> };
                };

                return JSON.stringify(data.teams.nodes, undefined, 2);
            },
            "List all teams in the Linear workspace, including their members and workflow states. Useful for finding team IDs, member IDs, and state IDs needed by other tools.",
        );
    }

    /**
     * Override ensureStart to inject the API key into tool args at execution time.
     * Custom tools don't have access to the config directly, so we store it
     * and inject it via a wrapper.
     */
    private _storedConfig: Record<string, string> = {};

    async ensureStart(config: Record<string, string>): Promise<boolean> {
        this._storedConfig = config;
        return await super.ensureStart(config);
    }

    async executeTool(
        userToolDisplayNameSuffix: string,
        args: Record<string, unknown>,
    ): Promise<string> {
        // Inject the API key into the args so custom tools can access it
        return await super.executeTool(userToolDisplayNameSuffix, {
            ...args,
            _apiKey: this._storedConfig.apiKey,
        });
    }
}
