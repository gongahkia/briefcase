[![](https://img.shields.io/badge/briefcase_1.0.0-passing-dark_green)](https://github.com/gongahkia/briefcase/releases/tag/1.0.0) 

# `BriefCase`

<p align="center">
    <img src="./asset/logo/briefcase.png" width=40% height=40%>
</p>

Web App that [brief](https://dictionary.cambridge.org/dictionary/english/brief)s you on [case](https://www.law.cornell.edu/wex/case)s through [Case Briefs](https://law.syracuse.edu/wp-content/uploads/Case-Briefing.pdf), pulled from [multiple sources](#sources).

## Rationale

...

## Stack

* *Frontend*: [React](https://react.dev/), [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
* *Backend*: [Node.js](https://nodejs.org/en), [Express.js](https://expressjs.com/)
* *Scrapers*: [Axios](https://axios-http.com/docs/intro), [Cheerio](https://cheerio.js.org/)
* *Package*: [Docker](https://www.docker.com/)
* *Web Server*: [Nginx](https://nginx.org/)
* *Schedule*: [Nodemon](https://www.npmjs.com/package/nodemon)

## Usage

...

```console
$ git clone 
```

Production Build and Run

```console
$ docker-compose up --build
$ docker-compose up -d --build
$ docker-compose logs -f
$ docker-compose down
```

Development Build and Run

```console
$ docker-compose -f docker-compose.dev.yml up --build
$ docker-compose -f docker-compose.dev.yml up -d --build
```

...

`./server/.env`

```env
# Server Configuration
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# LawNet OAuth Configuration
LAWNET_CLIENT_ID=your_lawnet_client_id
LAWNET_CLIENT_SECRET=your_lawnet_client_secret
LAWNET_REDIRECT_URI=http://localhost:3000/auth/callback
LAWNET_TOKEN_URL=https://auth.lawnet.sg/oauth/token
LAWNET_USER_INFO_URL=https://api.lawnet.sg/user/info

# LawNet API Configuration
LAWNET_API_BASE_URL=https://api.lawnet.sg
```

`./client/.env`

```env
HOST=0.0.0.0
PORT=3000
CHOKIDAR_USEPOLLING=true
REACT_APP_API_URL=http://localhost:3001
```

Then check the following API endpoints.

* *Frontend*: [`http://localhost:3000`](http://localhost:3000/)
* *Backend API*: [`http://localhost:3001`](http://localhost:3001/)
* *Health Check*: [`http://localhost:3001/health`](http://localhost:3001/health)

## Screenshot

...

## Sources

* [LawNet API](https://github.com/kengwoon/LawNet-APIs)
* [CommonLII](https://www.commonlii.org/sg/)
* [Singapore Courts](https://www.judiciary.gov.sg/)
* [OGP Pair Search](https://search.pair.gov.sg/)

## Architecture

### Overview

...

### User Sequence

```mermaid
sequenceDiagram
    actor User
    participant Frontend as Frontend (React)
    participant Backend as Backend (Express)
    participant Scrapers as Scrapers
    participant Sources as External Sources

    User->>Frontend: Uploads PDF/TXT document
    Frontend->>Frontend: Extract text (PDF.js)
    Frontend->>Frontend: Identify cases (Regex)
    
    loop For each identified case
        User->>Frontend: Selects search source
        Frontend->>Backend: POST /api/cases/search {caseName, source, apiKey?}
        
        alt Source = LawNet
            Backend->>Scrapers: LawNet API call
            Scrapers->>Sources: Authenticated request
            Sources-->>Scrapers: JSON response
        else Source = CommonLII
            Backend->>Scrapers: CommonLII scraper
            Scrapers->>Sources: HTTP request
            Sources-->>Scrapers: HTML response
            Scrapers->>Scrapers: Parse HTML (Cheerio)
        else Source = Singapore Courts
            Backend->>Scrapers: Courts scraper
            Scrapers->>Sources: HTTP request
            Sources-->>Scrapers: HTML response
            Scrapers->>Scrapers: Parse HTML
        else Source = OGP
            Backend->>Scrapers: OGP scraper
            Scrapers->>Sources: HTTP request
            Sources-->>Scrapers: JSON/HTML response
        end
        
        Scrapers-->>Backend: Formatted results
        Backend-->>Frontend: Structured case data
    end
    
    Frontend->>User: Display results
    User->>Frontend: Clicks case link
    Frontend->>Sources: Direct navigation (new tab)
```

## Reference

...
