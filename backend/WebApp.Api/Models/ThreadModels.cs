namespace WebApp.Api.Models;

public record ThreadInfo(
    string Id,
    string Title,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt,
    IReadOnlyDictionary<string, string>? Metadata
);

public record ThreadListResponse(
    List<ThreadInfo> Threads,
    int TotalCount
);

public record ThreadMessagesResponse(
    string ThreadId,
    List<MessageInfo> Messages
);

public record MessageInfo(
    string Id,
    string Role,
    string Content,
    DateTimeOffset Timestamp,
    List<FileAttachmentInfo>? Attachments
);

public record FileAttachmentInfo(
    string FileId,
    string FileName,
    long FileSizeBytes
);
