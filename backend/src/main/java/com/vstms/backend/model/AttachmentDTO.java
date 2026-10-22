package com.vstms.backend.model;

public class AttachmentDTO {
    private String name;
    private String type;
    private long size;
    private String dataUrl;
    private String url;

    public AttachmentDTO() {
    }

    public AttachmentDTO(String name, String type, long size, String dataUrl, String url) {
        this.name = name;
        this.type = type;
        this.size = size;
        this.dataUrl = dataUrl;
        this.url = url;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public long getSize() {
        return size;
    }

    public void setSize(long size) {
        this.size = size;
    }

    public String getDataUrl() {
        return dataUrl;
    }

    public void setDataUrl(String dataUrl) {
        this.dataUrl = dataUrl;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
