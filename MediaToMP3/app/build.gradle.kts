import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.FileInputStream
import java.util.Properties
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

// ---------------------------------------------------------------------------------------------
// Media to MP3 — Android app built with a lean, self-contained toolchain:
//   aapt2 (resources) -> kotlinc/javac (code) -> D8 (dex) -> zip -> zipalign -> apksigner
// It needs only an Android platform jar, the D8/R8 jar and aapt2/zipalign/apksigner binaries,
// so it builds in environments where the Android Gradle Plugin / Google Maven is unavailable.
// Run tools/bootstrap-sdk.sh once to install those pieces, then: gradle assembleDebug
// ---------------------------------------------------------------------------------------------

plugins {
    kotlin("jvm")
}

val appId = "com.example.mediatomp3"
val minSdk = 26
val targetSdk = 36
val compileSdk = 36
val versionCode = 1
val versionName = "1.0"

val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) FileInputStream(f).use { load(it) }
}
val sdkDir: File = file(
    localProps.getProperty("sdk.dir")
        ?: System.getenv("ANDROID_HOME")
        ?: System.getenv("ANDROID_SDK_ROOT")
        ?: "/opt/android-sdk"
)
// Classes are compiled against the newest platform; resources are linked against the newest
// platform the installed aapt2 can parse (overridable with -PresLinkSdk=NN).
val resLinkSdk = (findProperty("resLinkSdk") as String?)?.toInt() ?: 34
val androidJar = File(sdkDir, "platforms/android-$compileSdk/android.jar")
val resLinkJar = File(sdkDir, "platforms/android-$resLinkSdk/android.jar")
val d8Jar = File(sdkDir, "build-tools/r8/r8lib.jar")

fun tool(name: String): String {
    val candidates = listOf(File(sdkDir, "build-tools/bin/$name"), File("/usr/bin/$name"), File("/usr/local/bin/$name"))
    return candidates.firstOrNull { it.canExecute() }?.absolutePath ?: name
}

val ffmpegAar: Configuration by configurations.creating { isTransitive = false }

val buildDirF = layout.buildDirectory
val aarDir = buildDirF.dir("intermediates/aar/ffmpeg-kit")
val compiledRes = buildDirF.file("intermediates/res/compiled.zip")
val linkedRes = buildDirF.file("intermediates/res/resources.ap_")
val rJavaDir = buildDirF.dir("generated/source/r")
val dexDir = buildDirF.dir("intermediates/dex/debug")
val unsignedApk = buildDirF.file("intermediates/apk/app-debug-unaligned.apk")
val alignedApk = buildDirF.file("intermediates/apk/app-debug-aligned.apk")
val finalApk = buildDirF.file("outputs/apk/debug/app-debug.apk")

val extractFfmpegAar by tasks.registering(Sync::class) {
    from({ zipTree(ffmpegAar.singleFile) })
    into(aarDir)
}

dependencies {
    compileOnly(files(androidJar))
    implementation("com.arthenica:smart-exception-java:0.2.1")
    ffmpegAar("io.github.maitrungduc1410:ffmpeg-kit-audio:8.1.2@aar")
    implementation(files(aarDir.map { it.file("classes.jar") }).builtBy(extractFfmpegAar))
}

java {
    sourceCompatibility = JavaVersion.VERSION_11
    targetCompatibility = JavaVersion.VERSION_11
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_11)
        freeCompilerArgs.add("-Xno-param-assertions")
    }
}

sourceSets["main"].java.srcDir(rJavaDir)
sourceSets["main"].kotlin.srcDir("src/main/java")

val checkSdk by tasks.registering {
    doLast {
        listOf(androidJar, resLinkJar, d8Jar).forEach {
            if (!it.exists()) throw GradleException("Missing $it — run tools/bootstrap-sdk.sh first.")
        }
    }
}

val compileResources by tasks.registering(Exec::class) {
    dependsOn(checkSdk)
    val resDir = file("src/main/res")
    inputs.dir(resDir)
    outputs.file(compiledRes)
    doFirst { compiledRes.get().asFile.parentFile.mkdirs() }
    commandLine(tool("aapt2"), "compile", "--dir", resDir.absolutePath, "-o", compiledRes.get().asFile.absolutePath)
}

val linkResources by tasks.registering(Exec::class) {
    dependsOn(compileResources)
    val manifest = file("src/main/AndroidManifest.xml")
    inputs.file(manifest)
    inputs.file(compiledRes)
    outputs.file(linkedRes)
    outputs.dir(rJavaDir)
    doFirst {
        rJavaDir.get().asFile.deleteRecursively()
        rJavaDir.get().asFile.mkdirs()
    }
    commandLine(
        tool("aapt2"), "link",
        "-I", resLinkJar.absolutePath,
        "--manifest", manifest.absolutePath,
        "--min-sdk-version", minSdk.toString(),
        "--target-sdk-version", targetSdk.toString(),
        "--version-code", versionCode.toString(),
        "--version-name", versionName,
        "--rename-manifest-package", appId,
        "--auto-add-overlay",
        "--java", rJavaDir.get().asFile.absolutePath,
        "-o", linkedRes.get().asFile.absolutePath,
        compiledRes.get().asFile.absolutePath
    )
}

tasks.named("compileKotlin") { dependsOn(linkResources) }
tasks.named("compileJava") { dependsOn(linkResources) }

val dexDebug by tasks.registering(JavaExec::class) {
    dependsOn(tasks.named("jar"))
    val appJar = tasks.named<Jar>("jar").flatMap { it.archiveFile }
    val runtime = configurations.named("runtimeClasspath")
    inputs.file(appJar)
    inputs.files(runtime)
    outputs.dir(dexDir)
    classpath = files(d8Jar)
    mainClass.set("com.android.tools.r8.D8")
    doFirst {
        val out = dexDir.get().asFile
        out.deleteRecursively(); out.mkdirs()
        args = listOf(
            "--debug",
            "--min-api", minSdk.toString(),
            "--lib", androidJar.absolutePath,
            "--output", out.absolutePath,
            appJar.get().asFile.absolutePath
        ) + runtime.get().files.filter { it.name.endsWith(".jar") }.map { it.absolutePath }
    }
}

val packageDebug by tasks.registering {
    dependsOn(linkResources, dexDebug, extractFfmpegAar)
    inputs.file(linkedRes)
    inputs.dir(dexDir)
    inputs.dir(aarDir)
    outputs.file(unsignedApk)
    doLast {
        val out = unsignedApk.get().asFile
        out.parentFile.mkdirs()
        ZipOutputStream(out.outputStream().buffered()).use { zos ->
            fun put(name: String, bytes: ByteArray, store: Boolean) {
                val e = ZipEntry(name)
                if (store) {
                    e.method = ZipEntry.STORED
                    e.size = bytes.size.toLong()
                    e.compressedSize = bytes.size.toLong()
                    e.crc = CRC32().apply { update(bytes) }.value
                } else {
                    e.method = ZipEntry.DEFLATED
                }
                zos.putNextEntry(e); zos.write(bytes); zos.closeEntry()
            }
            // 1) Manifest + compiled resources (resources.arsc must stay uncompressed on API 30+).
            ZipFile(linkedRes.get().asFile).use { zf ->
                zf.entries().asSequence().filter { !it.isDirectory }.forEach { e ->
                    val bytes = zf.getInputStream(e).readBytes()
                    put(e.name, bytes, store = e.name == "resources.arsc" || e.method == ZipEntry.STORED)
                }
            }
            // 2) Dex files.
            dexDir.get().asFile.listFiles { f -> f.name.endsWith(".dex") }!!.sortedBy { it.name }.forEach {
                put(it.name, it.readBytes(), store = false)
            }
            // 3) FFmpeg native libraries.
            val jni = aarDir.get().asFile.resolve("jni")
            jni.walkTopDown().filter { it.isFile && it.name.endsWith(".so") }.sortedBy { it.path }.forEach {
                put("lib/" + it.relativeTo(jni).invariantSeparatorsPath, it.readBytes(), store = false)
            }
        }
    }
}

val zipalignDebug by tasks.registering(Exec::class) {
    dependsOn(packageDebug)
    inputs.file(unsignedApk)
    outputs.file(alignedApk)
    commandLine(tool("zipalign"), "-f", "-p", "4", unsignedApk.get().asFile.absolutePath, alignedApk.get().asFile.absolutePath)
}

val debugKeystore = file("debug.keystore")

val createDebugKeystore by tasks.registering(Exec::class) {
    onlyIf { !debugKeystore.exists() }
    commandLine(
        "keytool", "-genkeypair", "-v", "-keystore", debugKeystore.absolutePath,
        "-storepass", "android", "-alias", "androiddebugkey", "-keypass", "android",
        "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
        "-dname", "CN=Android Debug,O=Android,C=US"
    )
}

val signDebug by tasks.registering(Exec::class) {
    dependsOn(zipalignDebug, createDebugKeystore)
    inputs.file(alignedApk)
    outputs.file(finalApk)
    doFirst { finalApk.get().asFile.parentFile.mkdirs() }
    commandLine(
        tool("apksigner"), "sign",
        "--ks", debugKeystore.absolutePath,
        "--ks-pass", "pass:android",
        "--ks-key-alias", "androiddebugkey",
        "--key-pass", "pass:android",
        "--min-sdk-version", minSdk.toString(),
        "--out", finalApk.get().asFile.absolutePath,
        alignedApk.get().asFile.absolutePath
    )
}

val verifyDebugApk by tasks.registering(Exec::class) {
    dependsOn(signDebug)
    commandLine(tool("apksigner"), "verify", "--verbose", "--min-sdk-version", minSdk.toString(), finalApk.get().asFile.absolutePath)
}

tasks.register("assembleDebug") {
    group = "build"
    description = "Builds the installable debug APK (app/build/outputs/apk/debug/app-debug.apk)."
    dependsOn(verifyDebugApk)
    doLast {
        val apk = finalApk.get().asFile
        logger.lifecycle("APK ready: ${apk.absolutePath} (${apk.length() / 1024} KB)")
    }
}
