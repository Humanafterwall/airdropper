pluginManagement {
    repositories {
        // Maven Central mirror on Google Cloud Storage (avoids repo1 rate limits), then the defaults.
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
    }
}

rootProject.name = "MediaToMP3"
include(":app")
