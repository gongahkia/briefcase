from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.client import User
from diagrams.onprem.network import Nginx
from diagrams.programming.framework import React
from diagrams.programming.language import Nodejs
from diagrams.onprem.container import Docker
from diagrams.custom import Custom

with Diagram("BriefCase Architecture Diagram", show=False, direction="TB", outformat="png", filename="briefcase_architecture"):
    user = User("User")
    
    with Cluster("Frontend (React)"):
        react = React("React App")
        dropzone = Custom("File Dropzone", "dropzone_icon.png")
        text_area = Custom("Text Analysis", "text_icon.png")
        case_list = Custom("Case Selection UI", "list_icon.png")
        source_selector = Custom("Source Selector", "source_icon.png")
        config_ui = Custom("Config Dialog", "config_icon.png")
        api_ui = Custom("API Key Dialog", "key_icon.png")
        
        react - [dropzone, text_area, case_list, source_selector, config_ui, api_ui]

    with Cluster("Backend Services"):
        with Cluster("Express Server"):
            express = Nodejs("Express API")
            routes = [
                "POST /api/cases/search",
                "GET /api/config/status",
                "POST /api/config/set"
            ]
        
        with Cluster("Scraper Engine"):
            axios = Custom("HTTP Client", "axios_icon.png")
            cheerio = Custom("HTML Parser", "cheerio_icon.png")
            
            scrapers = [
                Custom("LawNet", "lawnet_icon.png"),
                Custom("CommonLII", "commonlii_icon.png"),
                Custom("Singapore Courts", "sgcourts_icon.png"),
                Custom("OGP Pair", "ogp_icon.png"),
                Custom("SLW", "slw_icon.png"),
                Custom("Judiciary SG", "judiciary_icon.png"),
                Custom("vLex", "vlex_icon.png")
            ]
            
            axios >> cheerio >> scrapers

    with Cluster("Infrastructure"):
        nginx = Nginx("Nginx Reverse Proxy")
        docker = Docker("Docker Container")
        redis = Custom("Redis Cache", "redis_icon.png")
        prometheus = Custom("Monitoring", "prometheus_icon.png")
        
        docker >> [nginx, redis, prometheus]

    # Data flow
    user >> Edge(label="Upload PDF/TXT\nor paste text") >> react
    react >> Edge(label="API Requests") >> express
    express >> Edge(label="Scrape Jobs") >> axios
    express >> Edge(label="Caching") >> redis
    axios >> Edge(label="Results") >> express
    express >> Edge(label="Response") >> react
    
    # Infrastructure connections
    express >> nginx
    nginx >> docker
    docker >> prometheus